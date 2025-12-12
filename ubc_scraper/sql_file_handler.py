from datetime import datetime
import os
import re

class SQLFileHandler:
    """
    Manages the output SQL file using hardcoded modes based on expected call order:
    1. export_bookings_to_sql uses 'w' (create/overwrite).
    2. export_rooms_to_sql uses 'a' (append).
    
    NOTE: This implementation requires 'export_bookings_to_sql' to always be 
    called before 'export_rooms_to_sql' for the desired 'w' then 'a' sequence.
    """
    def __init__(self, filename):
        self.filename = filename
            
    def escape_sql_string(self, text):
        # (escape_sql_string content remains the same)
        if text is None:
            return ''
        cleaned_text = str(text)
        cleaned_text = re.sub(r'[\n\r\t]+', ' ', cleaned_text)
        return cleaned_text.replace("'", "''")

    def export_rooms_to_sql(self, rooms_data_set):
        """Generates SQL INSERT statements for Rooms and APPENDS them to the file."""

        sql_statements = []
        TABLE_NAME = "Rooms"
        COLUMNS = ["room_number", "building", "capacity", "features"]
        column_list = ", ".join(COLUMNS)
        
        for room_tuple in rooms_data_set:
            room_number, building, capacity, features = room_tuple
            values = [
                f"'{self.escape_sql_string(str(room_number))}'" if room_number is not None else 'NULL', 
                f"'{self.escape_sql_string(building)}'",
                f"{capacity}" if capacity is not None else 'NULL',
                f"'{self.escape_sql_string(features)}'",
            ]
            values_list = ", ".join(values)
            sql = f"INSERT INTO {TABLE_NAME} ({column_list}) VALUES ({values_list});"
            sql_statements.append(sql)

        try:
            file_mode = 'w'
            
            with open(self.filename, file_mode, encoding='utf-8') as f: 
                
                # Add separators before writing Room data
                f.write("\n\n") 
                    
                f.write(f"-- SQL INSERT Statements for Rooms generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"-- Target Table: {TABLE_NAME}\n\n")
                f.write("\n".join(sql_statements))
                
            print(f"✅ Successfully exported {len(sql_statements)} unique Room details to '{os.path.abspath(self.filename)}' (Mode: '{file_mode}')")

        except IOError as e:
            print(f"❌ Error writing to file {self.filename}: {e}")

    # --- BOOKINGS EXPORT METHOD (Always uses 'w' - OVERWRITE/CREATE) ---

    def export_bookings_to_sql(self, bookings):
        """Generates SQL INSERT statements and WRITES/OVERWRITES the file."""
        
        sql_statements = []
        TABLE_NAME = "Bookings"
        COLUMNS = ["room_number", "building", "start_time", "end_time", "course_code", "instructor", "booking_type"]
        column_list = ", ".join(COLUMNS)
        
        for booking in bookings:
            # (Booking loop code is the same)
            values = [ 
                f"'{self.escape_sql_string(booking['room_number'])}'", f"'{self.escape_sql_string(booking['building'])}'",
                f"'{booking['start_time']}'", f"'{booking['end_time']}'", 
                f"'{self.escape_sql_string(booking['course_code'])}'",
                f"'{self.escape_sql_string(booking['instructor'])}'", f"'{self.escape_sql_string(booking['booking_type'])}'",
            ]
            values_list = ", ".join(values)
            sql = f"INSERT INTO {TABLE_NAME} ({column_list}) VALUES ({values_list});"
            sql_statements.append(sql)

        try:
            
            file_mode = 'a' 

            with open(self.filename, file_mode, encoding='utf-8') as f: 
                
                # Write the Bookings header (this clears any previous content)
                f.write(f"-- SQL INSERT Statements for Bookings generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"-- Target Table: {TABLE_NAME}\n\n")
                
                f.write("\n".join(sql_statements))
                
            print(f"✅ Successfully exported {len(sql_statements)} SQL INSERT statements to '{os.path.abspath(self.filename)}' (Mode: '{file_mode}')")

        except IOError as e:
            print(f"\n❌ Error writing to file {self.filename}: {e}")