# ==========================================
# UBC Online Timetable Scraper              
# Author: Karsten Uy
# ==========================================

# Goal, create a SQL file that I can shove into my DB

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import re
from datetime import datetime, timedelta
import os


OUTPUT_SQL_FILENAME = "timetable_bookings_insert.sql"
DEBUG = True

# Change the following to have the correct year
web     = 'https://sws-van.as.it.ubc.ca/SWS_2025/'
driver = webdriver.Chrome()

# =============================================
# HELPER FUNCTIONS

def escape_sql_string(text):
    """Escapes single quotes for use in SQL string literals."""
    if text is None:
        return ''
    
    # Ensure text is a string
    cleaned_text = str(text)
    
    # 1. Remove all newline characters (\n), carriage returns (\r), and tabs (\t)
    # Using re.sub is robust for all forms of whitespace control characters
    cleaned_text = re.sub(r'[\n\r\t]+', ' ', cleaned_text)

    # 2. Replace single quotes with '' to escape them for SQL
    return cleaned_text.replace("'", "''")


def export_bookings_to_sql(bookings, filename):
    """Generates SQL INSERT statements and writes them to a file."""
    
    sql_statements = []
    
    # Define the target table and columns
    TABLE_NAME = "Bookings"
    COLUMNS = [
        "room_number", 
        "building", 
        "start_time", 
        "end_time", 
        "course_code", 
        "instructor", 
        "booking_type"
    ]
    
    column_list = ", ".join(COLUMNS)
    
    for booking in bookings:
        # Prepare values, ensuring strings are escaped and quoted
        values = [
            # room_number is often a string, so we'll quote it and escape it for safety
            f"'{escape_sql_string(booking['room_number'])}'", 
            f"'{escape_sql_string(booking['building'])}'",
            f"'{booking['start_time']}'",  # DATETIME/TIMESTAMP should be quoted
            f"'{booking['end_time']}'",    # DATETIME/TIMESTAMP should be quoted
            f"'{escape_sql_string(booking['course_code'])}'",
            f"'{escape_sql_string(booking['instructor'])}'",
            f"'{escape_sql_string(booking['booking_type'])}'",
        ]
        
        values_list = ", ".join(values)
        
        # Construct the full INSERT statement
        sql = f"INSERT INTO {TABLE_NAME} ({column_list}) VALUES ({values_list});"
        sql_statements.append(sql)

    try:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"-- SQL INSERT Statements generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"-- Target Table: {TABLE_NAME}\n\n")
            f.write("\n".join(sql_statements))
            
        print(f"\n✅ Successfully exported {len(sql_statements)} SQL INSERT statements to '{os.path.abspath(filename)}'")

    except IOError as e:
        print(f"\n❌ Error writing to file {filename}: {e}")

def parse_timetable():
    print("New page title:", driver.title)

    tables = driver.find_elements(By.XPATH, '/html/body/table')
    print(f"Found {len(tables)} tables on the page")

    bookings = []

    current_room = None
    week_start_date = None # This will be the Monday of the week
    weekday_headers = []

    # Track ongoing rowspans per column (Mon=0, Tue=1, etc.)
    active_rowspans = [] 
    
    # Store the actual timestamp string for each half-hour row
    time_slots_list = [] 
    
    # Define a set of weekday names for offset calculation
    # Monday is index 0
    WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    for idx, table in enumerate(tables, start=1):
        # We only care about the timetable grid (even index tables)
        if idx % 2 == 1:
            # --- PHASE 1: Extract Room and Week Date (Odd Tables) ---
            rows = table.find_elements(By.XPATH, ".//tr")
            for row in rows:
                row_text = row.text.strip()
                if not row_text:
                    continue
                
                match_room = re.search(r'Location Timetable:\s*([A-Z]+)\s*(\d+)', row_text)
                if match_room:
                    building = match_room.group(1)
                    room_number = match_room.group(2)
                    current_room = (building, room_number)
                    print(f"Found room: {current_room[0]} {current_room[1]}")

                match_week = re.search(r'Exported Weeks:\d+,\s*(\d{2}/\d{2}/\d{2})', row_text)
                if match_week:
                    # 1. Parse the date string provided by the website (e.g., 09/01/25)
                    date_from_text = datetime.strptime(match_week.group(1), "%m/%d/%y")
                    
                    # 2. FIX: Calculate the actual Monday of that week
                    # weekday() returns 0 for Monday, 1 for Tuesday, ..., 6 for Sunday.
                    days_to_subtract = date_from_text.weekday()
                    
                    # 3. Set the true week_start_date (guaranteed Monday)
                    week_start_date = date_from_text - timedelta(days=days_to_subtract)
                    
                    print(f"Week start date (Actual Monday): {week_start_date.date()} (Original text date: {date_from_text.date()})")
            continue # Move to the next table

        # --- PHASE 2: Process Timetable Grid (Even Tables) ---
        if not current_room or not week_start_date:
            print("Skipping timetable grid: Missing room or week start date.")
            continue

        rows = table.find_elements(By.XPATH, ".//tr")
        # Reset time_slots_list for the new timetable grid/room
        time_slots_list = [] 

        for row_index, row in enumerate(rows):
            cells = row.find_elements(By.XPATH, ".//td")
            
            # Extract cell data with rowspan
            row_data = [(cell.text.strip(), int(cell.get_attribute("rowspan") or 1)) for cell in cells]
            

            if row_index == 0:
                # Row 0: Weekday headers (skip first cell which is empty/header)
                weekday_headers = [cell[0] for cell in row_data[1:]]
                active_rowspans = [0] * len(weekday_headers)
                continue

            # First cell is the time slot (if available)
            time_text = row_data[0][0]
            
            # This is the original part of the fix: Only add the time if it matches the pattern
            if re.match(r'^\d{1,2}:\d{2}$', time_text):
                time_slots_list.append(time_text)
                
            # FIX 1: The major fix for missing rows/bookings.
            # If time_slots_list is empty, we haven't found a time yet, so skip.
            # OR if we are on a row with no time text AND only the time column cell, skip (it's an empty row).
            if not time_slots_list or (not time_text and len(row_data) <= 1):
                 continue

            
            # Get the current time slot string (this will be the time from the last row that contained a time stamp)
            start_time_str = time_slots_list[-1]

            col_ptr = 0 # pointer to the actual weekday column (Mon=0, Tue=1, etc.)
            cell_index = 1 # pointer to the index in row_data (skipping the time column)

            # if row_index == 8:  # Debug Row 8 specifically
            #     print(f"DEBUG Row 8: weekday_headers = {weekday_headers}")
            #     print(f"DEBUG Row 8: row_data = {row_data}")

            while col_ptr < len(weekday_headers):
                
                # 1. Check for active rowspan: Column is blocked
                if active_rowspans[col_ptr] > 0:
                    active_rowspans[col_ptr] -= 1
                    col_ptr += 1 # Move to the next weekday column
                    continue
                
                # 2. Process a new cell if available
                if cell_index < len(row_data):
                    cell_text, rowspan = row_data[cell_index]
                    
                    # Heuristic check for the main booking cell 
                    # A cell is a *new* booking if it has content AND either:
                    # a) It has a rowspan > 1, OR
                    # b) It has the multi-line content structure (e.g. Course/Section/Number\nInstructor\nType\nDates)
                    # is_main_booking_cell = (rowspan > 1 and cell_text) or ('\n' in cell_text and cell_text.count('\n') >= 2)
                    is_main_booking_cell = (rowspan > 1 and cell_text)


                    if is_main_booking_cell:
                        # --- BOOKING EXTRACTION ---

                                                
                        # Print for debugging:
                        if DEBUG:
                            print(f"Row {row_index} - Processing booking at col_ptr={col_ptr}, cell_index={cell_index}")
                            print(f"Row {row_index} cells (Text, Rowspan): {row_data}")
                                          
                        weekday_name = weekday_headers[col_ptr]
                        try:
                            weekday_offset = WEEKDAYS.index(weekday_name)
                        except ValueError:
                            # Fallback to the column index if the header text is weird
                            print(f"Warning: Could not match weekday {weekday_name}. Assuming offset {col_ptr}.")
                            weekday_offset = col_ptr

                        print(f"weekday={weekday_name}, offset={weekday_offset}")                            
                        
                        # Use the true Monday start date + the day offset
                        booking_date = week_start_date + timedelta(days=weekday_offset)
                        
                        # Calculate start/end datetime
                        time_slot_obj = datetime.strptime(start_time_str, "%H:%M").time()
                        start_datetime = datetime.combine(booking_date.date(), time_slot_obj)
                        
                        duration = timedelta(minutes=30 * rowspan)
                        end_datetime = start_datetime + duration
                        
                        # Extract booking details (regex)
                        match_details = re.search(
                            r'(.+?)\s*/([A-Z0-9]+)\s*/(\d+)\s*\n' 
                            r'([^\n]*)\n' 
                            r'([A-Z]+)\n' 
                            r'(\d+-\d+)',
                            cell_text, re.DOTALL | re.MULTILINE
                        )
                        
                        course_code = 'N/A'
                        instructor = 'Unknown'
                        booking_type = 'OTHER'
                        
                        if match_details:
                            full_course_id = match_details.group(1).strip()
                            course_type_section = match_details.group(2).strip()
                            # Combine to get the full course code string
                            course_code = f"{full_course_id}/{course_type_section}/{match_details.group(3).strip()}"
                            
                            instructor = match_details.group(4).strip()
                            if not instructor or instructor.isspace():
                                instructor = 'Unknown'

                            booking_type = match_details.group(5).strip()
                        else:
                            # Handle non-standard bookings like MAINT or simple one-line entries
                            if 'MAINT' in cell_text.upper():
                                booking_type = 'MAINT'
                                course_code = cell_text[:100]
                            elif 'LEC' in cell_text.upper():
                                booking_type = 'LEC'
                                course_code = cell_text[:100]


                        bookings.append({
                            "room_number": current_room[1],
                            "building": current_room[0],
                            "start_time": start_datetime.strftime('%Y-%m-%d %H:%M:%S'),
                            "end_time": end_datetime.strftime('%Y-%m-%d %H:%M:%S'),
                            "course_code": course_code,
                            "instructor": instructor,
                            "booking_type": booking_type,
                            "raw_text": cell_text
                        })

                        # Print the latest booking added
                        latest = bookings[-1]
                        print(f"Added booking: [{latest['building']} {latest['room_number']}] {latest['start_time']} - {latest['end_time']} | {latest['course_code']} | {latest['instructor']} | {latest['booking_type']}")

                        # --- GRID UPDATE ---
                        active_rowspans[col_ptr] = rowspan - 1 # Current row is counted as 1
   
                        # ADVANCE CELL POINTER AND SKIP FRAGMENTS
                        cell_index += 1
                        # print(f"len(row_data) = {len(row_data)}")
                        # print(f"cell_index    = {cell_index}")
                        while cell_index < len(row_data):
                            next_text, next_rowspan = row_data[cell_index]
                            
                            # Only stop skipping if we hit the start of the next main booking (rowspan > 1) 
                            # or if the cell is non-fragmentary (has substantial content).
                            if next_rowspan > 1 or (next_rowspan == 1 and next_text and next_text.count('\n') >= 2):
                                # print("Breaking here")
                                break
                                
                            # print(f"skipping {next_text}")
                            cell_index += 1 # Skip this fragment
                        
                        # ADVANCE COLUMN POINTER
                        col_ptr += 1
                    else:
                        # Empty cell or already-skipped fragment
                        cell_index += 1
                        col_ptr += 1
                
                else:
                    # No more cells in row_data for this row, but check if we need to advance 
                    # the col_ptr for any remaining active rowspans.
                    if active_rowspans[col_ptr] > 0:
                        active_rowspans[col_ptr] -= 1
                        col_ptr += 1
                        continue # Continue the while loop to check the next column
                    
                    # If we ran out of cells and there are no active rowspans, we are done with this row
                    break 

    print(f"\nTotal bookings found: {len(bookings)}")
    
    if bookings:
        # --- SQL INSERT Statements (All Bookings) ---
        # print("\n--- SQL INSERT Statements (All Bookings) ---")
        # for booking in bookings: 
        #     print(f"INSERT INTO Bookings (room_number, building, start_time, end_time, course_code, instructor, booking_type) VALUES ({booking['room_number']}, '{booking['building']}', '{booking['start_time']}', '{booking['end_time']}', '{booking['course_code']}', '{booking['instructor']}', '{booking['booking_type']}');")
        export_bookings_to_sql(bookings, OUTPUT_SQL_FILENAME)

    input("Press Enter to exit...") 
    return bookings


# =============================================
# Stage 1 -> Pre Loop

print("Starting Web Scraping of UBC Online Timetable")

# Open website link
driver.get(web)
print(driver.title)

# Click General Teaching Spaces
gts_button = driver.find_element(by='xpath', value='//*[@id="LinkBtn_locationByZone"]')
driver.execute_script("arguments[0].click();", gts_button)

# Get possible Dates
week_list = driver.find_element(by='xpath', value='//*[@id="lbWeeks"]')
week_options = week_list.find_elements(By.TAG_NAME, "option")

# # Print elements debug
# for el in week_options:
#     print(el.text)

# Select all Rooms
room_list = driver.find_element(By.ID, "dlObject")
if DEBUG :
    driver.execute_script("""
        var select = arguments[0];
        for (var i = 0; i < 1; i++) {
            select.options[i].selected = true;
        }
    """, room_list)
else :
    driver.execute_script("""
        var select = arguments[0];
        for (var i = 0; i < select.options.length; i++) {
            select.options[i].selected = true;
        }
    """, room_list)
print("Selected all rooms via JS")

# Select the "All Day" option by value
period_dropdown = driver.find_element(By.ID, "dlPeriod")
period_select = Select(period_dropdown)
period_select.select_by_value("0-30")
print("Selected 'All Day 07:00 - 22:00' option")

# =============================================
# Stage 2 -> Outer Loop Over Weeks

for i in range(len(week_options)):

    # Refetch week list and options each loop to avoid stale references
    week_list = driver.find_element(By.XPATH, '//*[@id="lbWeeks"]')
    week_select = Select(week_list)
    week_options = week_list.find_elements(By.TAG_NAME, "option")

    week = week_options[i]

    # Skip anything that is not "w/c"
    if "w/c" not in week.text.lower():
        continue

    if (DEBUG) :
        if (i < 8) : continue

    week_select.deselect_all()
    week_text = week.text
    print(f"Selecting week: {week_text}")
    week_select.select_by_visible_text(week_text)

    # Wait a short moment to ensure selection is registered
    WebDriverWait(driver, 2).until(lambda d: True)

    # Click the "Get Timetable" button
    get_button = driver.find_element(By.XPATH, '//*[@id="bGetTimetable"]')
    driver.execute_script("arguments[0].click();", get_button)
    print("Clicked 'Get Timetable' button")

    # Wait for the new window/tab to open
    WebDriverWait(driver, 5).until(lambda d: len(d.window_handles) > 1)

    # Switch to the new window
    main_window = driver.current_window_handle
    new_window = [w for w in driver.window_handles if w != main_window][0]
    driver.switch_to.window(new_window)
    print("Switched to new timetable window")

    # ===== Interact with the new page here =====
    # Example: get the page title
    parse_timetable()

    # After you're done, close the new window
    driver.close()
    # Switch back to the original page
    driver.switch_to.window(main_window)










input("Press Enter to exit...")
# driver.quit()
