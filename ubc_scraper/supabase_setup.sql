-- DROPING TABLES
DROP TABLE IF EXISTS Bookings CASCADE;
DROP TABLE IF EXISTS Rooms CASCADE;

-- Table for Rooms
CREATE TABLE Rooms (
    room_number VARCHAR(50),
    building VARCHAR(50),
    capacity INT,
    features VARCHAR(1000),
    PRIMARY KEY (room_number,building)
);

-- Table for Bookings
CREATE TABLE Bookings (
    booking_id SERIAL PRIMARY KEY,
    room_number VARCHAR(50),
    building VARCHAR(50),
    FOREIGN KEY (room_number,building) REFERENCES Rooms,
    start_time  TIMESTAMP,
    end_time    TIMESTAMP,
    course_code VARCHAR(100),
    instructor VARCHAR(100),
    booking_type VARCHAR(20) -- e.g., LEC, MAINT
);


alter table Rooms enable row level security;
create policy "Allow public read access" on Rooms
for select
using (true);

alter table Bookings enable row level security;
create policy "Allow public read access" on Bookings
for select
using (true);

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS public.free_rooms_per_building(timestamp, timestamp) CASCADE;
DROP FUNCTION IF EXISTS public.free_rooms_list(timestamp, timestamp) CASCADE;
DROP FUNCTION IF EXISTS public.get_table_last_modified() CASCADE;

-- Function: free_rooms_per_building
CREATE OR REPLACE FUNCTION public.free_rooms_per_building(
  p_start timestamp,
  p_end timestamp
)
RETURNS TABLE(building text, free_room_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.building::text,
    COUNT(*)::bigint AS free_room_count
  FROM Rooms r
  WHERE NOT EXISTS (
    SELECT 1
    FROM Bookings b
    WHERE b.room_number = r.room_number
      AND b.building = r.building
      AND b.start_time < p_end
      AND b.end_time > p_start
  )
  GROUP BY r.building
  ORDER BY free_room_count DESC, building ASC;
END;
$$;

-- Function: free_rooms_list
CREATE OR REPLACE FUNCTION public.free_rooms_list(
  p_start timestamp,
  p_end timestamp
)
RETURNS TABLE(
  room_number text,  -- Changed from int to text
  building text,
  capacity int,
  features text,
  earliest_booking timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH free_count AS (
    SELECT 
      r.building,
      COUNT(*) AS free_room_count
    FROM Rooms r
    WHERE NOT EXISTS (
      SELECT 1
      FROM Bookings b
      WHERE b.room_number = r.room_number
        AND b.building = r.building
        AND b.start_time < p_end
        AND b.end_time > p_start
    )
    GROUP BY r.building
  )
  SELECT
    r.room_number::text,  -- Added ::text cast for safety
    r.building::text,
    r.capacity,
    r.features::text,
    (
      SELECT MIN(b.start_time)
      FROM Bookings b
      WHERE b.room_number = r.room_number
        AND b.building = r.building
        AND b.start_time >= p_end
        AND DATE(b.start_time) = DATE(p_start)  -- only same day bookings
    ) AS earliest_booking
  FROM Rooms r
  JOIN free_count fc ON r.building = fc.building
  WHERE NOT EXISTS (
    SELECT 1
    FROM Bookings b
    WHERE b.room_number = r.room_number
      AND b.building = r.building
      AND b.start_time < p_end
      AND b.end_time > p_start
  )
  ORDER BY fc.free_room_count DESC, r.building ASC, r.room_number ASC;
END;
$$;

CREATE OR REPLACE FUNCTION get_table_last_modified()
RETURNS TABLE(last_autoanalyze timestamptz, last_autovacuum timestamptz) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT last_autoanalyze, last_autovacuum
  FROM pg_stat_user_tables
  WHERE schemaname = 'public' 
  AND relname = 'bookings';
$$;





-- Current query

-- 1. For the Anti-Join (Overlap Check)
CREATE INDEX IF NOT EXISTS idx_bookings_overlap 
ON public.bookings (building, room_number, start_time, end_time);

-- 2. For the Lateral Join (Next Booking Lookup)
CREATE INDEX IF NOT EXISTS idx_bookings_next_time 
ON public.bookings (building, room_number, start_time);

-- Optional but recommended for the main table lookup
CREATE INDEX IF NOT EXISTS idx_rooms_pk ON public.rooms (building, room_number);

CREATE OR REPLACE FUNCTION public.free_rooms_list_optimized(
  p_start timestamp,
  p_end   timestamp
)
RETURNS TABLE(
  room_number text,
  building text,
  capacity int,
  features text,
  earliest_booking timestamp
)
LANGUAGE sql -- Changed to simple SQL language for better optimizer decisions
SECURITY DEFINER
AS $function$
  WITH 
  -- 1. Find all rooms that are NOT booked during the specified interval
  free_rooms AS (
    SELECT
      r.room_number,
      r.building,
      r.capacity,
      r.features
    FROM public.rooms r
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.room_number = r.room_number
        AND b.building = r.building
        -- Overlap check: start time before query end AND end time after query start
        AND b.start_time < p_end 
        AND b.end_time   > p_start
      -- Optimization: Use an index only if there's no overlap
    )
  ),
  
  -- 2. Calculate the count of free rooms per building (used for sorting)
  free_count AS (
    SELECT
      fr.building,
      COUNT(*)::INT AS free_room_count
    FROM free_rooms fr
    GROUP BY 1
  )

  -- 3. Final selection, joining the free rooms with the building count 
  -- and using a LATERAL join to find the next booking time efficiently.
  SELECT
    fr.room_number::text,
    fr.building::text,
    fr.capacity,
    fr.features::text,
    next_booking.start_time AS earliest_booking
  FROM free_rooms fr
  JOIN free_count fc 
    ON fr.building = fc.building
  -- LATERAL join to find the next booking time (optimized subquery)
  -- This runs the subquery only once per room identified as free.
  LEFT JOIN LATERAL (
    SELECT b.start_time
    FROM public.bookings b
    WHERE b.building = fr.building
      AND b.room_number = fr.room_number
      AND b.start_time >= p_end -- Find the first booking starting *after* the query ends
      AND b.start_time >= p_start::date -- Restrict to the same day (assuming p_start is the day start)
      AND b.start_time < p_start::date + interval '1 day' -- End of the day
    ORDER BY b.start_time ASC
    LIMIT 1
  ) AS next_booking ON TRUE
  -- Final Sorting
  ORDER BY 
    fc.free_room_count DESC, 
    fr.building ASC, 
    fr.room_number ASC;

$function$;