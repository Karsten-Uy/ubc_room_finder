-- DROPING TABLES
DROP TABLE IF EXISTS Bookings CASCADE;
DROP TABLE IF EXISTS Rooms CASCADE;

-- Table for Rooms
CREATE TABLE Rooms (
    room_number INT,
    building VARCHAR(50),
    capacity INT,
    features VARCHAR(1000),
    PRIMARY KEY (room_number,building)
);

-- Table for Bookings
CREATE TABLE Bookings (
    booking_id SERIAL PRIMARY KEY,
    room_number INT,
    building VARCHAR(50),
    FOREIGN KEY (room_number,building) REFERENCES Rooms,
    start_time  TIMESTAMP,
    end_time    TIMESTAMP,
    course_code VARCHAR(50),
    instructor VARCHAR(100),
    booking_type VARCHAR(20) -- e.g., LEC, MAINT
);

-- SELECT R.room_number, R.building, R.capacity, R.feautures
-- FROM Rooms R
-- LEFT JOIN Bookings B
--     ON R.room_number = B.room_number
--     AND R.building = B.building
--     AND NOT (B.end_time <= '2025-10-11 09:00:00' OR B.start_time >= '2025-10-11 10:00:00')
-- WHERE B.booking_id IS NULL;

-- Find Rooms that are free given a time range, sort by most frequent 

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS public.free_rooms_per_building(timestamp, timestamp) CASCADE;
DROP FUNCTION IF EXISTS public.free_rooms_list(timestamp, timestamp) CASCADE;

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
  room_number int,
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
    r.room_number,
    r.building::text,
    r.capacity,
    r.features::text,
    (
      SELECT MIN(b.start_time)
      FROM Bookings b
      WHERE b.room_number = r.room_number
        AND b.building = r.building
        AND b.start_time::date = p_start::date
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


