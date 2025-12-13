# ==========================================
# UBC Online Timetable Scraper (CSV VERSION)
# Author: Karsten Uy
# Modified to export CSV instead of SQL
# Version: 2.0 (with configurable CSV outputs)
# ==========================================

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support.ui import WebDriverWait
from bs4 import BeautifulSoup
import re
from datetime import datetime, timedelta
import os
import json
import csv
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

# ==========================================
# CONFIGURATION
# ==========================================

MAX_WORKERS = 8  # Parallel processing threads

# Compile regex patterns once (significant speedup)
ROOM_PATTERN = re.compile(r'Location Timetable:\s*([A-Z]+)\s*([A-Z]?\d+[A-Z]?)')
WEEK_PATTERN = re.compile(r'Exported Weeks:\d+,\s*(\d{2}/\d{2}/\d{2})')
CAPACITY_PATTERN = re.compile(r'Capacity:\s*(\d+)', re.IGNORECASE)
DETAILS_PATTERN = re.compile(
    r'(.+?)\s*/([A-Z0-9]+)\s*/(\d+)\s*\n([^\n]*)\n([A-Z]+)\n(\d+-\d+)',
    re.DOTALL | re.MULTILINE
)
TIME_PATTERN = re.compile(r'^\d{1,2}:\d{2}$')

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

# Change the following to have the correct year
WEB_URL = 'https://sws-van.as.it.ubc.ca/SWS_2025/'

# ==========================================
# ARGUMENT PARSING
# ==========================================

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='UBC Timetable Scraper - CSV Export')
    parser.add_argument(
        '--cache-dir',
        type=str,
        default='html_cache',
        help='Directory for caching HTML files (default: html_cache)'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable debug mode (limits weeks and rooms for testing)'
    )
    parser.add_argument(
        '--rooms-csv',
        type=str,
        default='rooms.csv',
        help='Output CSV file for rooms data (default: rooms.csv)'
    )
    parser.add_argument(
        '--bookings-csv',
        type=str,
        default='bookings.csv',
        help='Output CSV file for bookings data (default: bookings.csv)'
    )
    return parser.parse_args()

# ==========================================
# PHASE 1: HTML DOWNLOAD (Selenium)
# ==========================================

def download_week_htmls(cache_dir, debug):
    """Download all week HTMLs using Selenium. This cannot be parallelized."""
    
    print("=" * 60)
    print("PHASE 1: Downloading HTML pages")
    print("=" * 60)
    
    driver = webdriver.Chrome()
    
    try:
        # Open website
        driver.get(WEB_URL)
        print(f"Opened: {driver.title}")

        # Click General Teaching Spaces
        gts_button = driver.find_element(by='xpath', value='//*[@id="LinkBtn_locationByZone"]')
        driver.execute_script("arguments[0].click();", gts_button)

        # Get possible weeks
        week_list = driver.find_element(by='xpath', value='//*[@id="lbWeeks"]')
        week_options = week_list.find_elements(By.TAG_NAME, "option")

        # Select all rooms
        room_list = driver.find_element(By.ID, "dlObject")
        if debug:
            driver.execute_script("""
                var select = arguments[0];
                for (var i = 0; i < 30; i++) {
                    select.options[i].selected = true;
                }
            """, room_list)
            print("Selected 30 rooms (DEBUG mode)")
        else:
            driver.execute_script("""
                var select = arguments[0];
                for (var i = 0; i < select.options.length; i++) {
                    select.options[i].selected = true;
                }
            """, room_list)
            print("Selected all rooms")

        # Select "All Day" period
        period_dropdown = driver.find_element(By.ID, "dlPeriod")
        period_select = Select(period_dropdown)
        period_select.select_by_value("0-30")
        print("Selected 'All Day 07:00 - 22:00'")

        # Download each week
        downloaded_files = []
        
        for i in range(len(week_options)):
            # Refetch to avoid stale references
            week_list = driver.find_element(By.XPATH, '//*[@id="lbWeeks"]')
            week_select = Select(week_list)
            week_options = week_list.find_elements(By.TAG_NAME, "option")
            
            week = week_options[i]
            
            # Skip non-week entries
            if "w/c" not in week.text.lower():
                continue
            
            # Debug mode: limit weeks
            if debug and (i < 17 or i > 25):
                continue
            
            if not debug and i == 17:
                continue
            
            week_text = week.text
            cache_filename = os.path.join(cache_dir, f"week_{i:03d}.html")
            metadata_filename = os.path.join(cache_dir, f"week_{i:03d}.json")
            
            # Skip if already cached
            if os.path.exists(cache_filename):
                print(f"[{i}] Cached: {week_text}")
                downloaded_files.append((cache_filename, metadata_filename))
                continue
            
            print(f"[{i}] Downloading: {week_text}")
            
            week_select.deselect_all()
            week_select.select_by_visible_text(week_text)
            WebDriverWait(driver, 2).until(lambda d: True)
            
            # Click "Get Timetable"
            get_button = driver.find_element(By.XPATH, '//*[@id="bGetTimetable"]')
            driver.execute_script("arguments[0].click();", get_button)
            
            # Wait for new window
            WebDriverWait(driver, 5).until(lambda d: len(d.window_handles) > 1)
            
            # Switch to new window
            main_window = driver.current_window_handle
            new_window = [w for w in driver.window_handles if w != main_window][0]
            driver.switch_to.window(new_window)
            
            # Get HTML
            html = driver.page_source
            
            # Save HTML to cache
            with open(cache_filename, 'w', encoding='utf-8') as f:
                f.write(html)
            
            # Save metadata
            metadata = {
                'week_index': i,
                'week_text': week_text,
                'download_time': datetime.now().isoformat()
            }
            with open(metadata_filename, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2)
            
            downloaded_files.append((cache_filename, metadata_filename))
            
            # Close new window and return to main
            driver.close()
            driver.switch_to.window(main_window)
        
        print(f"\nDownloaded {len(downloaded_files)} weeks")
        return downloaded_files
        
    finally:
        driver.quit()

# ==========================================
# PHASE 2: HTML PARSING (BeautifulSoup + Parallel)
# ==========================================

def parse_week_html(file_tuple, debug):
    """Parse a single week's HTML file using BeautifulSoup."""
    
    cache_filename, metadata_filename = file_tuple
    
    # Load metadata
    with open(metadata_filename, 'r', encoding='utf-8') as f:
        metadata = json.load(f)
    
    week_text = metadata['week_text']
    
    if debug:
        print(f"Parsing: {week_text}")
    
    # Load HTML
    with open(cache_filename, 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    
    bookings = []
    rooms_set = set()
    
    current_room = None
    week_start_date = None
    
    # Find all tables
    tables = soup.find_all('table')
    
    for idx, table in enumerate(tables):
        text = table.get_text()
        
        # --- Extract Room Details ---
        if "Location Timetable:" in text:
            rows = table.find_all('tr')
            
            current_room = None
            capacity = None
            features = []
            
            for row in rows:
                row_text = row.get_text(strip=True)
                if not row_text:
                    continue
                
                # Extract room code
                match_room = ROOM_PATTERN.search(row_text)
                if match_room:
                    building = match_room.group(1)
                    room_number = match_room.group(2)
                    current_room = (building, room_number)
                
                # Extract week date
                match_week = WEEK_PATTERN.search(row_text)
                if match_week:
                    date_from_text = datetime.strptime(match_week.group(1), "%m/%d/%y")
                    days_to_subtract = date_from_text.weekday()
                    week_start_date = date_from_text - timedelta(days=days_to_subtract)
                
                # Extract capacity
                match_capacity = CAPACITY_PATTERN.search(row_text)
                if match_capacity:
                    try:
                        capacity = int(match_capacity.group(1))
                    except ValueError:
                        capacity = None
                
                # Extract features
                features_span = table.select_one('tbody > tr:nth-of-type(4) > td > table > tbody > tr > td:nth-of-type(1) > span')
                if features_span:
                    features_text = features_span.get_text(strip=True)
                    if features_text:
                        raw_features = [f.strip() for f in features_text.split(',') if f.strip()]
                        features = []
                        for raw_feature in raw_features:
                            parts = raw_feature.split(':', 1)
                            if len(parts) > 1:
                                features.append(parts[1].strip())
                            else:
                                features.append(raw_feature)
            
            # Store room data - ONLY if capacity is not None
            if current_room and capacity is not None:
                features_string = ", ".join(features)
                # Keep room number as string to preserve letters (e.g., "204A", "A100")
                room_number_str = current_room[1]
                room_tuple = (room_number_str, current_room[0], capacity, features_string)
                rooms_set.add(room_tuple)
        
        # --- Extract Bookings from Timetable Grid ---
        elif any(day in text for day in WEEKDAYS):
            if not current_room or not week_start_date:
                continue
            
            rows = table.find_all('tr')
            time_slots_list = []
            active_rowspans = []
            weekday_headers = []
            
            for row_index, row in enumerate(rows):
                cells = row.find_all('td')
                
                # Extract cell data with rowspan
                row_data = [(cell.get_text(strip=True), int(cell.get('rowspan', 1))) for cell in cells]
                
                if row_index == 0:
                    # Weekday headers
                    weekday_headers = [cell[0] for cell in row_data[1:]]
                    active_rowspans = [0] * len(weekday_headers)
                    continue
                
                # First cell is time slot
                time_text = row_data[0][0] if row_data else ""
                
                if TIME_PATTERN.match(time_text):
                    time_slots_list.append(time_text)
                
                if not time_slots_list or (not time_text and len(row_data) <= 1):
                    continue
                
                start_time_str = time_slots_list[-1]
                
                col_ptr = 0
                cell_index = 1
                
                while col_ptr < len(weekday_headers):
                    # Check for active rowspan
                    if active_rowspans[col_ptr] > 0:
                        active_rowspans[col_ptr] -= 1
                        col_ptr += 1
                        continue
                    
                    # Process new cell
                    if cell_index < len(row_data):
                        cell_text, rowspan = row_data[cell_index]
                        
                        is_main_booking_cell = (rowspan > 1 and cell_text)
                        
                        if is_main_booking_cell:
                            weekday_name = weekday_headers[col_ptr]
                            try:
                                weekday_offset = WEEKDAYS.index(weekday_name)
                            except ValueError:
                                weekday_offset = col_ptr
                            
                            booking_date = week_start_date + timedelta(days=weekday_offset)
                            time_slot_obj = datetime.strptime(start_time_str, "%H:%M").time()
                            start_datetime = datetime.combine(booking_date.date(), time_slot_obj)
                            
                            duration = timedelta(minutes=30 * rowspan)
                            end_datetime = start_datetime + duration
                            
                            # Extract booking details
                            course_code = 'N/A'
                            instructor = 'Unknown'
                            booking_type = 'OTHER'
                            
                            match_details = DETAILS_PATTERN.search(cell_text)
                            
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
                            
                            bookings.append({
                                "room_number": current_room[1],
                                "building": current_room[0],
                                "start_time": start_datetime.strftime('%Y-%m-%d %H:%M:%S'),
                                "end_time": end_datetime.strftime('%Y-%m-%d %H:%M:%S'),
                                "course_code": course_code,
                                "instructor": instructor,
                                "booking_type": booking_type
                            })
                            
                            active_rowspans[col_ptr] = rowspan - 1
                            
                            # Skip fragments
                            cell_index += 1
                            while cell_index < len(row_data):
                                next_text, next_rowspan = row_data[cell_index]
                                if next_rowspan > 1 or (next_rowspan == 1 and next_text and next_text.count('\n') >= 2):
                                    break
                                cell_index += 1
                            
                            col_ptr += 1
                        else:
                            cell_index += 1
                            col_ptr += 1
                    else:
                        if active_rowspans[col_ptr] > 0:
                            active_rowspans[col_ptr] -= 1
                            col_ptr += 1
                            continue
                        break
    
    if debug:
        print(f"  → {len(bookings)} bookings, {len(rooms_set)} rooms")
    
    return bookings, rooms_set

def parse_all_weeks_parallel(downloaded_files, debug):
    """Parse all weeks in parallel using ThreadPoolExecutor."""
    
    print("\n" + "=" * 60)
    print("PHASE 2: Parsing HTML (Parallel)")
    print("=" * 60)
    
    all_bookings = []
    all_rooms_set = set()
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(parse_week_html, file_tuple, debug): file_tuple for file_tuple in downloaded_files}
        
        for future in as_completed(futures):
            try:
                bookings, rooms_set = future.result()
                all_bookings.extend(bookings)
                all_rooms_set.update(rooms_set)
            except Exception as e:
                print(f"Error parsing file: {e}")
    
    print(f"\nTotal bookings: {len(all_bookings)}")
    print(f"Total unique rooms: {len(all_rooms_set)}")
    
    return all_bookings, all_rooms_set

# ==========================================
# PHASE 3: CSV EXPORT
# ==========================================

def export_to_csv(all_bookings, all_rooms_set, rooms_csv, bookings_csv):
    """Export parsed data to CSV files."""
    
    print("\n" + "=" * 60)
    print("PHASE 3: Exporting to CSV")
    print("=" * 60)
    
    # Export rooms to CSV
    if all_rooms_set:
        with open(rooms_csv, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            # Write header
            writer.writerow(['room_number', 'building', 'capacity', 'features'])
            # Write data
            for room in sorted(all_rooms_set):
                writer.writerow(room)
        print(f"Exported {len(all_rooms_set)} rooms to {rooms_csv}")
    
    # Export bookings to CSV
    if all_bookings:
        with open(bookings_csv, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'room_number', 'building', 'start_time', 'end_time',
                'course_code', 'instructor', 'booking_type'
            ])
            # Write header
            writer.writeheader()
            # Write data
            for booking in all_bookings:
                writer.writerow(booking)
        print(f"Exported {len(all_bookings)} bookings to {bookings_csv}")
    
    print(f"\nCSV files created:")
    print(f"  - {rooms_csv}")
    print(f"  - {bookings_csv}")

# ==========================================
# MAIN EXECUTION
# ==========================================

if __name__ == "__main__":
    # Parse command line arguments
    args = parse_arguments()
    
    print("\n" + "=" * 60)
    print("UBC TIMETABLE SCRAPER (CSV VERSION)")
    print("=" * 60)
    print(f"Cache directory: {args.cache_dir}")
    print(f"Rooms CSV: {args.rooms_csv}")
    print(f"Bookings CSV: {args.bookings_csv}")
    print(f"Debug mode: {'ENABLED' if args.debug else 'DISABLED'}")
    print("=" * 60 + "\n")
    
    # Create cache directory
    os.makedirs(args.cache_dir, exist_ok=True)
    
    start_time = datetime.now()
    
    # Phase 1: Download HTMLs (cannot be parallelized)
    downloaded_files = download_week_htmls(args.cache_dir, args.debug)
    
    # Phase 2: Parse HTMLs (parallelized)
    all_bookings, all_rooms_set = parse_all_weeks_parallel(downloaded_files, args.debug)
    
    # Phase 3: Export to CSV
    export_to_csv(all_bookings, all_rooms_set, args.rooms_csv, args.bookings_csv)
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    print("\n" + "=" * 60)
    print(f"COMPLETE - Total time: {duration:.2f} seconds")
    print("=" * 60)