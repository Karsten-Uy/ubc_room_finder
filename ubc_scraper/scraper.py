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
from selenium.common.exceptions import NoSuchElementException
import sql_file_handler



OUTPUT_SQL_FILENAME = "timetable_bookings_insert.sql"
DEBUG = True

# Change the following to have the correct year
web     = 'https://sws-van.as.it.ubc.ca/SWS_2025/'
driver = webdriver.Chrome()

# =============================================
# HELPER FUNCTIONS

# Initialize lists to store ALL data
all_bookings = []
all_rooms_set = set() # Store unique rooms collected from all weeks
file_handler = sql_file_handler.SQLFileHandler(OUTPUT_SQL_FILENAME)

def parse_timetable():
    print("New page title:", driver.title)

    tables = driver.find_elements(By.XPATH, '/html/body/table')
    print(f"Found {len(tables)} tables on the page")

    bookings = []
    Rooms_set = set() # New set to store unique room data tuples

    current_room = None
    week_start_date = None # This will be the Monday of the week
    weekday_headers = []
    
    # Define a set of weekday names for offset calculation
    WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


    for idx, table in enumerate(tables, start=1):

        print(f"Processing table {idx}/{len(tables)}\n")

        text = table.text

        # --- PHASE 1: Extract Room Details, Capacity, Features, and Week Date
        if "Location Timetable:" in text:
            rows = table.find_elements(By.XPATH, ".//tr")
            
            # Reset room details for this table set
            current_room = None
            capacity = None # Should be an integer
            features = []
            
            for row in rows:
                row_text = row.text.strip()
                if not row_text:
                    continue
                
                # 1. Extract Room Code
                match_room = re.search(r'Location Timetable:\s*([A-Z]+)\s*(\d+)', row_text)
                if match_room:
                    building = match_room.group(1)
                    room_number = match_room.group(2)
                    current_room = (building, room_number)
                    if DEBUG: print(f"Found room: {current_room[0]} {current_room[1]}")

                # 2. Extract Week Date
                match_week = re.search(r'Exported Weeks:\d+,\s*(\d{2}/\d{2}/\d{2})', row_text)
                if match_week:
                    date_from_text = datetime.strptime(match_week.group(1), "%m/%d/%y") # Assuming MM/DD/YY
                    days_to_subtract = date_from_text.weekday()
                    week_start_date = date_from_text - timedelta(days=days_to_subtract)
                    if DEBUG: print(f"Week start date (Actual Monday): {week_start_date.date()}")
                
                # 3. Extract Capacity
                match_capacity = re.search(r'Capacity:\s*(\d+)', row_text, re.IGNORECASE)
                if match_capacity:
                    try:
                        capacity = int(match_capacity.group(1))
                        if DEBUG: print(f"Extracted Capacity: {capacity}")
                    except ValueError:
                        capacity = None
            
            
                # 4. Extract Features using specific XPath (Robust handling for NoSuchElementException)
                try:
                    features_element = table.find_element(By.XPATH, './tbody/tr[4]/td/table/tbody/tr/td[1]/span')
                    
                    # Use get_attribute("textContent") for robustness
                    features_text = features_element.get_attribute("textContent").strip()
                    
                    if features_text:
                        raw_features = [f.strip() for f in features_text.split(',') if f.strip()]
                        
                        features = []
                        for raw_feature in raw_features:
                            # Strip the leading identifier (e.g., "F: ", "B: ")
                            parts = raw_feature.split(':', 1)
                            if len(parts) > 1:
                                features.append(parts[1].strip())
                            else:
                                features.append(raw_feature)
                        
                        if DEBUG:
                            print(f"Extracted Features via XPath: {', '.join(features)}")
                    
                except NoSuchElementException:
                    # If the span is missing, features remain the empty list []
                    if DEBUG:
                         print("Warning: Could not find specific features span at the expected XPath. Features will be empty.")
            
            # 5. Store unique Room Data in the set
            if current_room:
                features_string = ", ".join(features)
                # Attempt to convert room number to int for consistent primary key type
                room_number_for_set = int(current_room[1]) if current_room[1].isdigit() else current_room[1]
                
                # Add the tuple to the set
                room_tuple = (room_number_for_set, current_room[0], capacity, features_string)
                Rooms_set.add(room_tuple)

        elif any(day in text for day in ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]):

            # --- PHASE 2: Process Timetable Grid (Even Tables) ---
            if not current_room or not week_start_date:
                print("Skipping timetable grid: Missing room or week start date.")
                continue

            rows = table.find_elements(By.XPATH, ".//tr")
            # Reset time_slots_list for the new timetable grid/room
            time_slots_list = [] 

            # Track ongoing rowspans per column (Mon=0, Tue=1, etc.)
            active_rowspans = [] 
            
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
                
                if re.match(r'^\d{1,2}:\d{2}$', time_text):
                    time_slots_list.append(time_text)
                
                if not time_slots_list or (not time_text and len(row_data) <= 1):
                    continue
                
                start_time_str = time_slots_list[-1]

                col_ptr = 0 # pointer to the actual weekday column (Mon=0, Tue=1, etc.)
                cell_index = 1 # pointer to the index in row_data (skipping the time column)
                
                while col_ptr < len(weekday_headers):
                    
                    # 1. Check for active rowspan: Column is blocked
                    if active_rowspans[col_ptr] > 0:
                        active_rowspans[col_ptr] -= 1
                        col_ptr += 1 # Move to the next weekday column
                        continue
                    
                    # 2. Process a new cell if available
                    if cell_index < len(row_data):
                        cell_text, rowspan = row_data[cell_index]
                        
                        # Heuristic: A cell is a *new* booking if it has content AND has rowspan > 1
                        is_main_booking_cell = (rowspan > 1 and cell_text)
                        
                        if is_main_booking_cell:
                            # --- BOOKING EXTRACTION (omitted for brevity) ---
                            
                            if DEBUG:
                                print(f"Row {row_index} - Processing booking at col_ptr={col_ptr}, cell_index={cell_index}")
                                # print(f"Row {row_index} cells (Text, Rowspan): {row_data}") # Commented for clean output
                                
                            weekday_name = weekday_headers[col_ptr]
                            try:
                                weekday_offset = WEEKDAYS.index(weekday_name)
                            except ValueError:
                                weekday_offset = col_ptr
                                
                            # Use the true Monday start date + the day offset
                            booking_date = week_start_date + timedelta(days=weekday_offset)
                            time_slot_obj = datetime.strptime(start_time_str, "%H:%M").time()
                            start_datetime = datetime.combine(booking_date.date(), time_slot_obj)
                            
                            duration = timedelta(minutes=30 * rowspan)
                            end_datetime = start_datetime + duration
                            
                            # Extract booking details (regex) - Omitted for brevity
                            course_code = 'N/A'
                            instructor = 'Unknown'
                            booking_type = 'OTHER'
                            
                            # Regex matching... (needs to be kept in your actual script)
                            match_details = re.search(r'(.+?)\s*/([A-Z0-9]+)\s*/(\d+)\s*\n([^\n]*)\n([A-Z]+)\n(\d+-\d+)', cell_text, re.DOTALL | re.MULTILINE)
                            
                            if match_details:
                                full_course_id = match_details.group(1).strip()
                                course_type_section = match_details.group(2).strip()
                                course_code = f"{full_course_id}/{course_type_section}/{match_details.group(3).strip()}"
                                instructor = match_details.group(4).strip() or 'Unknown'
                                booking_type = match_details.group(5).strip()
                            else:
                                if 'MAINT' in cell_text.upper():
                                    booking_type = 'MAINT'
                                    course_code = cell_text[:100]
                                elif 'LEC' in cell_text.upper():
                                    booking_type = 'LEC'
                                    course_code = cell_text[:100]
                                
                            # --- APPEND BOOKING ---
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

                            if DEBUG:
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
                                    break
                                    
                                cell_index += 1 # Skip this fragment
                            
                            # ADVANCE COLUMN POINTER
                            col_ptr += 1
                        else:
                            # Empty cell or fragment (rowspan=1 and non-main content)
                            # We MUST consume the cell and advance the column pointer to stay aligned.
                            cell_index += 1
                            col_ptr += 1
                    
                    else:
                        # Ran out of cells, but check if we need to advance col_ptr for active rowspans.
                        if active_rowspans[col_ptr] > 0:
                            active_rowspans[col_ptr] -= 1
                            col_ptr += 1
                            continue 
                        
                        # If we ran out of cells and there are no active rowspans, we are done with this row
                        break 
        else:
            # Ignore irrelevant tables (print date, wrappers, spacing)
            continue

    # 1. Add new bookings to the master list
    all_bookings.extend(bookings) 
    
    # 2. Add new rooms to the master set
    all_rooms_set.update(Rooms_set)

    # Final export sequence
    print(f"\nTotal bookings found: {len(bookings)}")        
    print(f"Total unique rooms found: {len(Rooms_set)}")
    
    # input("Press Enter to exit...") 
    return all_bookings

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
        for (var i = 0; i < 15; i++) {
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
        if (i < 17 or i > 25) : continue

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

# =============================================
# Stage 3 -> Final Export (OUTSIDE the loop)

print(f"\n--- FINAL EXPORT ---\n")
print(f"Total unique rooms collected: {len(all_rooms_set)}")
print(f"Total bookings collected: {len(all_bookings)}")

if all_rooms_set:
    file_handler.export_rooms_to_sql(all_rooms_set)
    
if all_bookings:
    file_handler.export_bookings_to_sql(all_bookings)

driver.quit()
