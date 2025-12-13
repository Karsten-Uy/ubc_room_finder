# UBC Timetable Scraper (CSV Export)

## 🎯 What is this

This is a data collection web scraper script that extracts room booking and room specification data from the official UBC online timetable at `https://sws-van.as.it.ubc.ca/SWS_2025/`. It uses **Selenium** for web automation and **BeautifulSoup** for efficient HTML parsing.

Upon successful completion, it processes and exports the collected information into two structured CSV files:
* `rooms.csv` (Contains permanent room details like capacity and features)
* `bookings.csv` (Contains temporary booking records with start/end times and course details)

These files are designed to be easily imported directly into a database (such as a Supabase backend for a web application).

---

## 🚀 How to Run

This set of instructions is for running the script without any changes. For better performance or configuration, you may want to modify the `Makefile` or `optimized_scraper.py`. See the `WEEK LIMITERS` section in `optimized_scraper.py` for how to limit what weeks are scraped

### 1. Prerequisites

Ensure the following tools and access rights are secured before running the script:

| Prerequisite | Purpose |
| :--- | :--- |
| **Python 3.x** | The scripting environment. |
| **Google Chrome** | The browser engine used by the Selenium tool.  |
| **Chromedriver** | The matching executable for your installed Chrome version; it must be installed and accessible in your system's PATH. |
| **UBC VPN Access** | **Crucial:** The scraper must be connected to the **UBC VPN** to reach the internal timetable server (`sws-van.as.it.ubc.ca`). |

### 2. Setup and Installation

1.  **Navigate to the Directory:**
    Open your terminal or command prompt (e.g., Git Bash) and change directory to where the script is located (e.g., `/ubc_scraper/`).

2.  **Create and Activate a Virtual Environment (Recommended):**
    ```bash
    # Create the environment
    python -m venv venv
    
    # Activate the environment (Linux/macOS)
    source venv/bin/activate
    
    # Activate the environment (Windows/Command Prompt)
    .\venv\Scripts\activate
    ```

3.  **Install Dependencies:**
    Install the necessary Python packages listed in `requirements.txt`:
    ```bash
    pip install -r requirements.txt
    ```

### 3. Execution

1.  **Verify VPN Connection:** **STOP** and ensure you are actively connected to the **UBC VPN**.
2.  **Run the Scraper:**

    * **Option A: Using `make`** (If you have a `Makefile` configured with a `run` command)
        ```bash
        make run
        ```
    * **Option B: Running Python Directly**
        ```bash
        python your_scraper_script_name.py
        # Replace 'your_scraper_script_name.py' with the actual filename.
        ```

### 4. Wait for Completion

The scraping process involves downloading and parsing data for many weeks and rooms. Due to the reliance on Selenium and the sequential nature of the timetable system interface, this step takes significant time.

The script is expected to take approximately **1.5 hours** to complete the full dataset collection.

Once finished, the following files will be created or overwritten in the script directory:

* `rooms.csv`
* `bookings.csv`

---
*Note: The script also generates an `html_cache` directory containing raw HTML files, allowing for faster subsequent parsing if the Selenium download step is skipped.*

### 5. Upload CSVs to Supabase

The final step is loading the collected data into your database instance. 

1.  **Run Setup SQL:**
    In the Supabase interface for your UBC Room Finder instance, navigate to the **SQL Editor**. Run the commands contained in the `supabase_setup.sql` file. This drops the previous tables and recreates them (`rooms` and `bookings`). If just adding new data, can skip this step

2.  **Import `rooms.csv`:**
    Go to the **Table Editor**, find the `rooms` table, and use the **Import Data** feature to upload and insert the data from your generated `rooms.csv` file.

3.  **Import `bookings.csv`:**
    Repeat the process for the `bookings` table, importing the data from your generated `bookings.csv` file.

