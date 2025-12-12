'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type DisclaimerWidgetProps = {
  title?: string
  text?: React.ReactNode
}

export default function DisclaimerWidget({ title = "UBC Free Room Finder Disclaimer", text }: DisclaimerWidgetProps) {
  const supabase = createClient()
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [latestBookingEnd, setLatestBookingEnd] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: rpcData } = await supabase.rpc('get_table_last_modified')
        const lastModified = rpcData?.[0]?.last_modified || rpcData?.[0]?.last_autoanalyze || rpcData?.[0]?.last_autovacuum
        setLastUpdated(lastModified ? new Date(lastModified).toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : "Unknown")

        const { data: bookingData } = await supabase
          .from('bookings')
          .select('end_time')
          .order('end_time', { ascending: false })
          .limit(1)
          .maybeSingle()
        setLatestBookingEnd(bookingData?.end_time ? new Date(bookingData.end_time).toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : "Unknown")
      } catch {
        setLastUpdated("Unknown")
        setLatestBookingEnd("Unknown")
      }
    }
    fetchData()
  }, [])

  return (
    <div className="p-6 mt-4 w-full max-w-4xl mx-auto bg-yellow-100 dark:bg-yellow-800 rounded-xl shadow-md border border-yellow-300 dark:border-yellow-600 mb-6">
      <h2 className="text-xl font-bold mb-2 text-yellow-900 dark:text-yellow-100">{title}</h2>
      <p className="text-gray-800 dark:text-gray-200">
        This website is for informational purposes only. The data provided may not be accurate or up-to-date.{" "}
        Always confirm room availability with official sources. The data comes from{" "}
        <a
          href="https://sws-van.as.it.ubc.ca/SWS_2025/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          https://sws-van.as.it.ubc.ca/SWS_2025/
        </a>
        {" "} and is obtained via a webscraper script made with Selenium that captures the bookings at a set time. Note that the schedules change during exam seasons and at the start of a new year, and the script must be rerun to get new data. Also, just because a room is marked as free does NOT mean it is unoccupied.
      </p>

      {/* Only render dynamic times on client */}
      <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
        {lastUpdated ? `The database was last modified around ${lastUpdated}.` : 'Fetching last database modification time...'}<br />
        {latestBookingEnd ? `The latest booking in the current instance ends on ${latestBookingEnd}.` : 'Fetching latest booking end time...'}
      </p>
    </div>
  )
}
