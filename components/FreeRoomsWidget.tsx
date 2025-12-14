'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type BuildingCount = {
  building: string
  free_room_count: number
}

type FreeRoom = {
  room_number: string
  building: string
  capacity: number
  features: string | null
  earliest_booking: string | null
}

// Define the number of rows per page
const ROWS_PER_PAGE = 10 

export default function FreeRoomsWidget() {
  const supabase = createClient()

  const [selectedDate, setSelectedDate] = useState<string>('')
  const [startTime, setStartTime] = useState<string>('')
  const [endTime, setEndTime] = useState<string>('')

  const [perBuilding, setPerBuilding] = useState<BuildingCount[]>([])
  const [freeRooms, setFreeRooms] = useState<FreeRoom[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [timeWarning, setTimeWarning] = useState<string | null>(null)
  const [timeError, setTimeError] = useState<string | null>(null)
  const [invalidField, setInvalidField] = useState<"start" | "end" | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [typingStart, setTypingStart] = useState<string | null>(null)
  const [typingEnd, setTypingEnd] = useState<string | null> (null)
  const [startDelta, setStartDelta] = useState<number>(180) // default 3h

  // Separate states for pagination: one for buildings, one for rooms
  const [currentBuildingPage, setCurrentBuildingPage] = useState(1)
  const [currentRoomPage, setCurrentRoomPage] = useState(1)
  
  // Building search filter
  const [buildingSearch, setBuildingSearch] = useState<string>('')

  // --- NEW HELPER FUNCTION FOR MAP LINK ---
  const formatBuildingMapLink = (building: string) =>
    `https://maps.ubc.ca/?code=${building}`

  useEffect(() => {
    setIsClient(true)
    const now = new Date()
    const later = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    let startTimeStr = now.toTimeString().slice(0, 5)
    let endTimeStr = later.toTimeString().slice(0, 5)

    // Initial time setup - Clamping is done here for a good default view
    const initialClamp = (time: string): string => {
      if (time < "07:00") return "07:00"
      if (time > "22:00") return "22:00"
      return time
    }

    startTimeStr = initialClamp(startTimeStr)
    endTimeStr = initialClamp(endTimeStr)

    // Format date as YYYY-MM-DD using local timezone
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const localDateStr = `${year}-${month}-${day}`

    setSelectedDate(localDateStr)
    setStartTime(startTimeStr)
    setEndTime(endTimeStr)

    const deltaMinutes =
      parseInt(endTimeStr.slice(0, 2)) * 60 +
      parseInt(endTimeStr.slice(3)) -
      (parseInt(startTimeStr.slice(0, 2)) * 60 + parseInt(startTimeStr.slice(3)))
    setStartDelta(deltaMinutes)

    fetchData(localDateStr, startTimeStr, endTimeStr)
  }, [])

  const clampWithWarning = (value: string, field: "start" | "end", showWarning: boolean = false): string => {
    if (value < "07:00") {
      if (showWarning) {
        setTimeWarning("Time cannot be earlier than 7:00 AM.")
        setInvalidField(field)
      }
      return "07:00"
    }
    if (value > "22:00") {
      if (showWarning) {
        setTimeWarning("Time cannot be later than 10:00 PM.")
        setInvalidField(field)
      }
      return "22:00"
    }
    return value
  }

  useEffect(() => {
    if (!typingStart) return
    const timer = setTimeout(() => {
      // --- CHANGE 1: DO NOT CLAMP WHILE TYPING ---
      const newStart = typingStart
      
      let [h, m] = newStart.split(":").map(Number)
      
      // Calculate new end time based on the new start time + delta
      let newEndMinutes = h * 60 + m + startDelta
      
      // Prevent weird wrapping when calculating the companion time
      if (newEndMinutes > 24 * 60) newEndMinutes = 24 * 60 
      if (newEndMinutes < 0) newEndMinutes = 0
      
      const newEnd = `${String(Math.floor(newEndMinutes / 60) % 24).padStart(2, "0")}:${String(newEndMinutes % 60).padStart(2, "0")}`
      
      setStartTime(newStart) // Store the raw time
      setEndTime(newEnd)
      setTypingStart(null)
    }, 350)
    return () => clearTimeout(timer)
  }, [typingStart, startDelta])

  useEffect(() => {
    if (!typingEnd) return
    const timer = setTimeout(() => {
      // --- CHANGE 2: DO NOT CLAMP WHILE TYPING ---
      const newEnd = typingEnd

      // Use current startTime (which may be raw, un-clamped) to calculate delta
      const startMinutes = parseInt(startTime.slice(0, 2)) * 60 + parseInt(startTime.slice(3))
      const endMinutes = parseInt(newEnd.slice(0, 2)) * 60 + parseInt(newEnd.slice(3))
      
      // Recalculate and set delta based on raw times
      setStartDelta(endMinutes - startMinutes)
      setEndTime(newEnd) // Store the raw time
      setTypingEnd(null)
    }, 350)
    return () => clearTimeout(timer)
  }, [typingEnd, startTime])

  const toTimestamp = (date: string, time: string) =>
  `${date} ${time}:00`

  const fetchData = async (date?: string, start?: string, end?: string) => {
    const d = date ?? selectedDate
    // Use the raw, potentially un-clamped values stored in state
    const sRaw = start ?? startTime
    const eRaw = end ?? endTime
    if (!d || !sRaw || !eRaw) return
    
    // Clear all messages before validation
    setTimeWarning(null)
    setTimeError(null)
    setSuccessMessage(null)
    setInvalidField(null)
    
    // --- CLAMPING HERE: Only clamp when search is triggered (fetchData is called) ---
    let wasClamped = false
    let clampMessage = ""
    
    const s = clampWithWarning(sRaw, "start", false)
    if (s !== sRaw) {
      wasClamped = true
      if (sRaw < "07:00") {
        clampMessage = "Start time adjusted from before 7:00 AM to 7:00 AM."
      } else if (sRaw > "22:00") {
        clampMessage = "Start time adjusted from after 10:00 PM to 10:00 PM."
      }
    }
    
    const e = clampWithWarning(eRaw, "end", false)
    if (e !== eRaw) {
      wasClamped = true
      if (eRaw < "07:00") {
        clampMessage = clampMessage ? `${clampMessage} End time adjusted from before 7:00 AM to 7:00 AM.` : "End time adjusted from before 7:00 AM to 7:00 AM."
      } else if (eRaw > "22:00") {
        clampMessage = clampMessage ? `${clampMessage} End time adjusted from after 10:00 PM to 10:00 PM.` : "End time adjusted from after 10:00 PM to 10:00 PM."
      }
    }
    
    // Re-set the state to the clamped values so the user sees the final time used
    // But ONLY if we are using the current state values, not initial load
    if(!start && !end) {
      setStartTime(s)
      setEndTime(e)
    }

    // Check if end time is after start time
    const startDate = new Date(`${d}T${s}`)
    const endDate = new Date(`${d}T${e}`)
    
    if (endDate <= startDate) {
      setTimeError("End time must be after start time.")
      setInvalidField("end")
      // Clear results when there's an error
      setPerBuilding([])
      setFreeRooms([])
      setSelectedBuilding(null)
      return
    }
    
    setLoading(true)
    
    const startTs = toTimestamp(d, s)
    const endTs = toTimestamp(d, e)

    // FIX: Added schema option to prevent HTTP 300 errors from Supabase/PostgREST ambiguity
    const rpcOptions = { head: false, schema: 'public' }

    const { data: perBuildingData, error: perBuildingErr } =
      await supabase.rpc("free_rooms_per_building", {
        p_start: startTs,
        p_end: endTs,
      }, rpcOptions) 

    // FIX: Added schema option to prevent HTTP 300 errors from Supabase/PostgREST ambiguity
    const { data: freeRoomsData, error: freeRoomsErr } =
      await supabase.rpc("free_rooms_list", {
        p_start: startTs,
        p_end: endTs,
      }, rpcOptions) 
      
    if (perBuildingErr || freeRoomsErr) {
      console.error(perBuildingErr || freeRoomsErr) 
      setLoading(false)
      return
    }
    setPerBuilding(perBuildingData ?? [])
    setFreeRooms(freeRoomsData ?? [])
    setSelectedBuilding(null)
    setCurrentBuildingPage(1) // Reset building page
    setCurrentRoomPage(1)    // Reset room list page
    setLoading(false)
    
    // Set success or warning message based on whether clamping occurred
    if (wasClamped) {
      setTimeWarning(`${clampMessage} Search completed with ${(freeRoomsData ?? []).length} free rooms found.`)
      setSuccessMessage(null)
    } else {
      setTimeWarning(null)
      setSuccessMessage(`Found ${(freeRoomsData ?? []).length} free rooms for your search.`)
    }
  }

  const toggleBuilding = (building: string) => {
    setSelectedBuilding((prev) => (prev === building ? null : building))
    setCurrentRoomPage(1) // Reset room list page when the filter changes
  }

  const filteredRooms = selectedBuilding
    ? freeRooms.filter((room) => room.building === selectedBuilding)
    : freeRooms

  const formatRoomLink = (building: string, room_number: string) =>
    `https://learningspaces.ubc.ca/find-a-space/?classroom=${building.toLowerCase()}-${room_number}`

  // --- FILTER BUILDINGS BY SEARCH ---
  const filteredBuildings = perBuilding.filter((row) =>
    row.building.toLowerCase().includes(buildingSearch.toLowerCase())
  )

  // --- PAGINATION LOGIC FOR BUILDING COUNT TABLE ---
  const totalBuildingPages = Math.ceil(filteredBuildings.length / ROWS_PER_PAGE)
  const buildingStartIndex = (currentBuildingPage - 1) * ROWS_PER_PAGE
  const buildingEndIndex = buildingStartIndex + ROWS_PER_PAGE
  const paginatedBuildings = filteredBuildings.slice(buildingStartIndex, buildingEndIndex)

  const handleBuildingPageChange = (page: number) => {
    if (page >= 1 && page <= totalBuildingPages) {
      setCurrentBuildingPage(page)
      document.querySelector('#building-count-table')?.scrollIntoView({ behavior: 'smooth' })
    }
  }
  
  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentBuildingPage(1)
  }, [buildingSearch])

  // --- PAGINATION LOGIC FOR FREE ROOMS LIST TABLE ---
  const totalRoomPages = Math.ceil(filteredRooms.length / ROWS_PER_PAGE)
  const roomStartIndex = (currentRoomPage - 1) * ROWS_PER_PAGE
  const roomEndIndex = roomStartIndex + ROWS_PER_PAGE
  const paginatedRooms = filteredRooms.slice(roomStartIndex, roomEndIndex)

  const handleRoomPageChange = (page: number) => {
    if (page >= 1 && page <= totalRoomPages) {
      setCurrentRoomPage(page)
      document.querySelector('#free-rooms-table')?.scrollIntoView({ behavior: 'smooth' })
    }
  }


  if (!isClient) {
    return (
      <div className="p-6 w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Free Room Search</h1>
        <div className="text-center py-8">Loading...</div>
      </div>
    )
  }

  return (
    <div className="mb-6 p-6 w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Free Room Search</h1>
      
      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Find available rooms on campus by selecting a date and time range. By default, the search shows rooms available for the next 3 hours. Click a building in the “Free Rooms Per Building” table to filter free room results by that building. Note that the times are only accurate in PST/PDT.
      </p>

      {/* Date/Time Inputs (unchanged) */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Start Time</label>
            <input
              type="time"
              // Removed min/max attributes here to allow user input beyond limits
              value={typingStart ?? startTime}
              onChange={(e) => setTypingStart(e.target.value)}
              className={`w-full px-2 sm:px-3 py-1 sm:py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${invalidField === "start" ? "border-red-500" : ""}`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">End Time</label>
            <input
              type="time"
              // Removed min/max attributes here to allow user input beyond limits
              value={typingEnd ?? endTime}
              onChange={(e) => setTypingEnd(e.target.value)}
              className={`w-full px-2 sm:px-3 py-1 sm:py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${invalidField === "end" ? "border-red-500" : ""}`}
            />
          </div>
        </div>

        {timeError && <div className="text-red-600 dark:text-red-400 text-sm mt-1 font-medium">{timeError}</div>}
        {timeWarning && <div className="text-amber-600 dark:text-amber-400 text-sm mt-1 font-medium">{timeWarning}</div>}
        {successMessage && <div className="text-green-600 dark:text-green-400 text-sm mt-1">{successMessage}</div>}

        <button
          onClick={() => fetchData()}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "Loading…" : "Search"}
        </button>
      </div>

      {/* Free Rooms Per Building (PAGINATED) */}
      <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100" id="building-count-table">Free Rooms Per Building</h2>
      
      {/* Building Search Bar */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Search buildings..."
          value={buildingSearch}
          onChange={(e) => setBuildingSearch(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
        />
      </div>
      
      <div className="overflow-x-auto mb-2">
        <table className="w-full min-w-[300px] border-collapse border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="px-2 sm:px-3 py-1 sm:py-2 border">Building</th>
              <th className="px-2 sm:px-3 py-1 sm:py-2 border"># Free Rooms</th>
              <th className="px-2 sm:px-3 py-1 sm:py-2 border">Directions</th>
            </tr>
          </thead>
          <tbody>
            {/* Use paginatedBuildings for rendering */}
            {paginatedBuildings.map((row) => {
              const isSelected = selectedBuilding === row.building
              return (
                <tr
                  key={row.building}
                  className={`hover:bg-gray-200 dark:hover:bg-gray-700 ${isSelected ? "bg-blue-200 dark:bg-blue-600" : ""}`}
                >
                  <td 
                    className="px-2 sm:px-3 py-1 sm:py-2 border cursor-pointer"
                    onClick={() => toggleBuilding(row.building)}
                  >
                    {row.building}
                  </td>
                  <td 
                    className="px-2 sm:px-3 py-1 sm:py-2 border cursor-pointer text-center"
                    onClick={() => toggleBuilding(row.building)}
                  >
                    {row.free_room_count}
                  </td>
                  <td className="px-2 sm:px-3 py-1 sm:py-2 border text-center">
                    <a
                      href={formatBuildingMapLink(row.building)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400 inline-flex items-center justify-center"
                    >
                      Map
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls for Building Count - UPDATED DISPLAY */}
      {totalBuildingPages > 1 && (
        <div className="mt-4 mb-6 flex justify-between items-center text-gray-700 dark:text-gray-300">
          <span>
            Showing {buildingStartIndex + 1} - {Math.min(buildingEndIndex, filteredBuildings.length)} of {filteredBuildings.length} results
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => handleBuildingPageChange(currentBuildingPage - 1)}
              disabled={currentBuildingPage === 1}
              className="px-3 py-1 border rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => handleBuildingPageChange(currentBuildingPage + 1)}
              disabled={currentBuildingPage === totalBuildingPages}
              className="px-3 py-1 border rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* All Free Rooms / Filtered (PAGINATED) - REMOVED TOTAL COUNT FROM HEADING */}
      <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100" id="free-rooms-table">
        {selectedBuilding ? `Free Rooms in ${selectedBuilding}` : "All Free Rooms"}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="px-3 py-2 border text-left">Building</th>
              <th className="px-3 py-2 border text-left">Room Number</th>
              <th className="px-3 py-2 border text-left">Seating Capacity</th>
              <th className="px-3 py-2 border text-left">Room Details</th>
              <th className="px-3 py-2 border text-left">Earliest Booking</th>
            </tr>
          </thead>
          <tbody>
            {/* Map over paginatedRooms */}
            {paginatedRooms.map((room, i) => (
              <tr key={roomStartIndex + i} className="hover:bg-gray-200 dark:hover:bg-gray-700">
                <td className="px-3 py-2 border">{room.building}</td>
                <td className="px-3 py-2 border">{room.room_number}</td>
                <td className="px-3 py-2 border">{room.capacity}</td>
                <td className="px-3 py-2 border">
                  <a
                    href={formatRoomLink(room.building, room.room_number)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View Details
                  </a>
                </td>
                <td className="px-3 py-2 border">
                  {isClient && room.earliest_booking
                    ? new Date(room.earliest_booking).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "Free rest of day"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls for Free Rooms List - UPDATED DISPLAY */}
      {totalRoomPages > 1 && (
        <div className="mt-4 flex justify-between items-center text-gray-700 dark:text-gray-300">
          <span>
            Showing {roomStartIndex + 1} - {Math.min(roomEndIndex, filteredRooms.length)} of {filteredRooms.length} results
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => handleRoomPageChange(currentRoomPage - 1)}
              disabled={currentRoomPage === 1}
              className="px-3 py-1 border rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => handleRoomPageChange(currentRoomPage + 1)}
              disabled={currentRoomPage === totalRoomPages}
              className="px-3 py-1 border rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}