# UBC Room Finder Project

## ✨ Project Summary

The **UBC Room Finder Project** is a full-stack solution designed to quickly identify available classroom and lecture spaces at UBC. The project is split into two parts:

1.  **Data Ingestion (Backend):** A Python web scraper collects room booking and facility data from the [UBC Online Timetable](https://sws-van.as.it.ubc.ca/SWS_2025/).
2.  **Web Application (Frontend):** A Next.js application powered by Supabase and deployed on **Vercel** allows users to dynamically search, filter, and view free rooms based on date and time. This system helps students and staff find immediate, unscheduled room access.

## 🚀 Technologies Used

This project utilizes a modern stack across scraping, data storage, and presentation:

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Scraping** | **Python**, **Selenium**, **BeautifulSoup** | Automation, data extraction, and parsing from the [UBC Online Timetable](https://sws-van.as.it.ubc.ca/SWS_2025/). |
| **Database** | **Supabase** (PostgreSQL) | Primary data storage, hosting `rooms` and `bookings` tables, and running query logic via stored procedures (RPCs).  |
| **Frontend** | **Next.js** (React) | Application framework for server-side rendering (SSR) and routing. |
| **Deployment** | **Vercel** | Hosting and automated deployment of the Next.js application. |
| **Styling/UI** | **Tailwind CSS** | Utility-first CSS framework for rapid UI development. |

---

## 📁 Project Structure

The project directory contains:

| Directory/File | Description |
| :--- | :--- |
| `ubc_scraper/` | Contains the Python web scraper script and its dedicated `README.md` with instructions on setup and execution. |
| `supabase_setup.sql` | SQL file for setting up the necessary tables and stored procedures in your Supabase database. |
| `components/` | (In Next.js app) Contains the React components like `FreeRoomsWidget` and `DisclaimerWidget`. |
| `.env.local` | Configuration file for the Next.js app (must contain Supabase credentials). |

---

## 💻 Part 1: Data Scraping (Backend)

The scraper collects room availability data from the [UBC Online Timetable](https://sws-van.as.it.ubc.ca/SWS_2025/) website. This process is necessary to populate the database used by the web application and should be rerun whenever the schedule has changed significalty such as during the start of the year and once exam schedules come out. To see how to run it and upload the data to supabase, see the `README.md` in the `ubc_scraper/` directory.

## 🌐 Part 2: Web Application (Frontend)

The frontend is a Next.js application designed to query the Supabase database and display the room availability data.

### 1. Prerequisites (Web App)

* **Node.js (LTS)** and **npm** or **Yarn/pnpm**.
* **Supabase Project** with the tables/functions set up (see Part 2).
* **Vercel** for deployment

### 2. Configuration

1.  **Supabase Environment Variables:** Create a file named `.env.local` in the **root directory** of the project (if it doesn't exist) and populate it with your Supabase credentials:

    ```bash
    NEXT_PUBLIC_SUPABASE_URL="YOUR_SUPABASE_URL"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
    ```

### 3. Installation and Running

1.  **Navigate to Root Directory:** Ensure you are in the root directory of the project.
2.  **Install Dependencies:**
    ```bash
    npm install
    # or yarn install / pnpm install
    ```
3.  **Run the Development Server:**
    ```bash
    npm run dev
    # or yarn dev / pnpm dev
    ```
    The application will be accessible at `http://localhost:3000`.

### 4. Deployment

The application is built with Next.js and is optimized for deployment on **Vercel**.

1.  **Link to Vercel:** Initialize a new Vercel project linked to this Git repository.
2.  **Configure Environment Variables:** In your Vercel project settings, set the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables.
3.  **Deploy:** Vercel will automatically build and deploy the application.

---

## 🔍 Frontend Feature Overview

The application features two main components, built in React/Next.js:

### 1. `FreeRoomsWidget`

This is the core search interface, which uses client-side logic and Supabase RPCs to deliver dynamic results.

| Feature | Description |
| :--- | :--- |
| **Search Functionality** | Calls Supabase Remote Procedure Calls (RPCs) to fetch available rooms based on user-selected date/time range (7:00 AM to 10:00 PM). |
| **Time Sync** | Automatically adjusts the end time to maintain duration when the start time is edited, and vice-versa. |
| **Building Filter** | Displays a count of free rooms per building and allows filtering of the main room list by clicking a building name. |
| **Room Details** | Provides a link to the UBC Learning Spaces website for specific room details. |
| **Earliest Booking** | Shows the next scheduled booking time for the room (for the rest of the search day). |

### 2. `DisclaimerWidget`

This component displays important information regarding the data's source and validity.

| Data Point | Source |
| :--- | :--- |
| **Data Range** | Dynamically reports the **Earliest Booking Start Time** and **Latest Booking End Time** currently in the `bookings` table. |
| **Last Modified Time** | Dynamically fetched from Supabase table metadata. |
| **Warning** | Explicitly states that the data is for informational purposes only and must be confirmed with official UBC sources. |
