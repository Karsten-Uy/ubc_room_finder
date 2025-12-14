'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type DisclaimerWidgetProps = {
  title?: string
  text?: React.ReactNode
}

export default function DisclaimerWidget({ title = "Disclaimer", text }: DisclaimerWidgetProps) {
  const supabase = createClient()
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [latestBookingEnd, setLatestBookingEnd] = useState<string | null>(null)
  // 1. Add new state for the earliest booking start time
  const [earliestBookingStart, setEarliestBookingStart] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: rpcData } = await supabase.rpc('get_table_last_modified')
        const lastModified = rpcData?.[0]?.last_modified || rpcData?.[0]?.last_autoanalyze || rpcData?.[0]?.last_autovacuum
        setLastUpdated(lastModified ? new Date(lastModified).toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : "Unknown")

        // Fetch Latest Booking End Time (Existing Logic)
        const { data: endData } = await supabase
          .from('bookings')
          .select('end_time')
          .order('end_time', { ascending: false })
          .limit(1)
          .maybeSingle()
        setLatestBookingEnd(endData?.end_time ? new Date(endData.end_time).toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : "Unknown")
        
        // 2. Add new query for the Earliest Booking Start Time
        const { data: startData } = await supabase
          .from('bookings')
          .select('start_time')
          .order('start_time', { ascending: true }) // <--- Order by ascending to get the earliest
          .limit(1)
          .maybeSingle()
        setEarliestBookingStart(startData?.start_time ? new Date(startData.start_time).toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : "Unknown")

      } catch (error) {
        console.error("Error fetching disclaimer data:", error)
        setLastUpdated("Unknown")
        setLatestBookingEnd("Unknown")
        setEarliestBookingStart("Unknown") // 3. Handle error for new state
      }
    }
    fetchData()
  }, [])

  return (
    <div className="p-6 mt-4 w-full max-w-4xl mx-auto bg-yellow-100 dark:bg-yellow-900 rounded-xl shadow-md border border-yellow-300 dark:border-yellow-600 mb-6">
      <h2 className="text-xl font-bold mb-2 text-yellow-900 dark:text-yellow-100">{title}</h2>      
      <p className="text-gray-800 dark:text-gray-200">
        This site is for informational purposes only and is <span className="font-bold italic text-red-600 dark:text-red-400">NOT</span> affiliated with UBC in any official capacity. Room availability is based on data from the{" "}
        <a
          href="https://sws-van.as.it.ubc.ca/SWS_2025/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          UBC Online Timetable
        </a>{" "}
        and is captured as a snapshot. Schedules can change during exams, at the start of the year, or at other times, and this site updates only when I manually refresh the data. 
        If it seems outdated, click "Report Issue," select "Request latest room data," and submit the form. I will update the database when I get the time.{" "}
        <span className="font-bold italic text-red-600 dark:text-red-400">
          This is NOT a booking system. A room listed as free does NOT guarantee that it is unoccupied.
        </span>
      </p>


      <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
        {lastUpdated ? `Database last updated on ${lastUpdated}.` : 'Fetching last update...'}<br />
        {earliestBookingStart ? `Earliest booking in current database starts on ${earliestBookingStart}.` : 'Fetching earliest booking...'}<br />
        {latestBookingEnd ? `Latest booking in current database  ends on ${latestBookingEnd}.` : 'Fetching latest booking...'}
      </p>

      <p className="mt-4 text-gray-800 dark:text-gray-200">
        <span className="font-bold italic text-red-600 dark:text-red-400">
          Please do not share this site widely. 
        </span>{" "}
        This site runs on Vercel and Supabase free tiers, so sharing could incur costs. If you want it expanded and are willing to help, send a request via the "Report Issue" button and we can discuss.
      </p>
    </div>
  )
}