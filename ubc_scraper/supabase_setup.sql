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

-- Function: free_rooms_per_building (LIMITED TO 100 RESULTS)
CREATE OR REPLACE FUNCTION public.free_rooms_per_building(
  p_start timestamp,
  p_end timestamp
)
RETURNS TABLE(building text, free_room_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
  ORDER BY free_room_count DESC, building ASC
  LIMIT 100;
END;
$function$;

-- 1. For the Anti-Join (Overlap Check)
CREATE INDEX IF NOT EXISTS idx_bookings_overlap 
ON public.bookings (building, room_number, start_time, end_time);

-- 2. For the Lateral Join (Next Booking Lookup)
CREATE INDEX IF NOT EXISTS idx_bookings_next_time 
ON public.bookings (building, room_number, start_time);

-- Optional but recommended for the main table lookup
CREATE INDEX IF NOT EXISTS idx_rooms_pk ON public.rooms (building, room_number);

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

-- Function: get_table_last_modified
CREATE OR REPLACE FUNCTION get_table_last_modified()
RETURNS TABLE(last_autoanalyze timestamptz, last_autovacuum timestamptz) 
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT last_autoanalyze, last_autovacuum
  FROM pg_stat_user_tables
  WHERE schemaname = 'public' 
  AND relname = 'bookings';
$function$;
