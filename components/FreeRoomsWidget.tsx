'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type BuildingCount = {
  building: string
  free_room_count: number
}

type FreeRoom = {
  room_number: number
  building: string
  capacity: number
  features: string | null
  earliest_booking: string | null
}

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
  const [invalidField, setInvalidField] = useState<"start" | "end" | null>(null)

  // Debounce typing
  const [typingStart, setTypingStart] = useState<string | null>(null)
  const [typingEnd, setTypingEnd] = useState<string | null>(null)

  // Delta between start and end in minutes
  const [startDelta, setStartDelta] = useState<number>(180) // default 3h

  // On mount, initialize times
  useEffect(() => {
    setIsClient(true)
    const now = new Date()
    const later = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    let startTimeStr = now.toTimeString().slice(0, 5)
    let endTimeStr = later.toTimeString().slice(0, 5)

    // Clamp start between 07:00 and 19:00 (so end <= 22:00)
    if (startTimeStr < "07:00") {
      startTimeStr = "07:00"
      endTimeStr = "10:00"
    }
    if (startTimeStr > "19:00") {
      startTimeStr = "19:00"
      endTimeStr = "22:00"
    }

    setSelectedDate(now.toISOString().slice(0, 10))
    setStartTime(startTimeStr)
    setEndTime(endTimeStr)

    const deltaMinutes =
      parseInt(endTimeStr.slice(0, 2)) * 60 +
      parseInt(endTimeStr.slice(3)) -
      (parseInt(startTimeStr.slice(0, 2)) * 60 + parseInt(startTimeStr.slice(3)))
    setStartDelta(deltaMinutes)

    fetchData(now.toISOString().slice(0, 10), startTimeStr, endTimeStr)
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

  // Debounce start time input
  useEffect(() => {
    if (!typingStart) return

    const timer = setTimeout(() => {
      const clampedStart = clampWithWarning(typingStart, "start", false)

      // Apply delta
      let [h, m] = clampedStart.split(":").map(Number)
      let newEndMinutes = h * 60 + m + startDelta

      if (newEndMinutes > 22 * 60) newEndMinutes = 22 * 60
      if (newEndMinutes < 7 * 60) newEndMinutes = 7 * 60

      const newEnd = `${String(Math.floor(newEndMinutes / 60)).padStart(2, "0")}:${String(
        newEndMinutes % 60
      ).padStart(2, "0")}`

      setStartTime(clampedStart)
      setEndTime(newEnd)

      setTypingStart(null)
    }, 350)

    return () => clearTimeout(timer)
  }, [typingStart, startDelta])

  // Debounce end time input
  useEffect(() => {
    if (!typingEnd) return

    const timer = setTimeout(() => {
      const clampedEnd = clampWithWarning(typingEnd, "end", false)

      // Update delta
      const startMinutes = parseInt(startTime.slice(0, 2)) * 60 + parseInt(startTime.slice(3))
      const endMinutes = parseInt(clampedEnd.slice(0, 2)) * 60 + parseInt(clampedEnd.slice(3))
      setStartDelta(endMinutes - startMinutes)

      setEndTime(clampedEnd)
      setTypingEnd(null)
    }, 350)

    return () => clearTimeout(timer)
  }, [typingEnd, startTime])

  const fetchData = async (date?: string, start?: string, end?: string) => {
    const d = date ?? selectedDate
    const sRaw = start ?? startTime
    const eRaw = end ?? endTime
    if (!d || !sRaw || !eRaw) return

    // Clamp and show warnings only on search
    const s = clampWithWarning(sRaw, "start", true)
    const e = clampWithWarning(eRaw, "end", true)

    if (new Date(`${d}T${e}`) <= new Date(`${d}T${s}`)) {
      setTimeWarning("End time must be after start time.")
      setInvalidField("end")
      return
    }

    setTimeWarning(null)
    setInvalidField(null)

    setLoading(true)

    const { data: perBuildingData, error: perBuildingErr } =
      await supabase.rpc("free_rooms_per_building", { p_start: `${d}T${s}`, p_end: `${d}T${e}` })
    const { data: freeRoomsData, error: freeRoomsErr } =
      await supabase.rpc("free_rooms_list", { p_start: `${d}T${s}`, p_end: `${d}T${e}` })

    if (perBuildingErr || freeRoomsErr) {
      console.error(perBuildingErr || freeRoomsErr)
      setLoading(false)
      return
    }

    setPerBuilding(perBuildingData ?? [])
    setFreeRooms(freeRoomsData ?? [])
    setSelectedBuilding(null)
    setLoading(false)
  }

  const toggleBuilding = (building: string) => {
    setSelectedBuilding((prev) => (prev === building ? null : building))
  }

  const filteredRooms = selectedBuilding
    ? freeRooms.filter((room) => room.building === selectedBuilding)
    : freeRooms

  const formatRoomLink = (building: string, room_number: number) => {
    const buildingSlug = building.toLowerCase()
    return `https://learningspaces.ubc.ca/find-a-space/?classroom=${buildingSlug}-${room_number}`
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
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Free Room Search</h1>

      {/* Date/Time Inputs */}
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Start Time</label>
            <input
              type="time"
              min="07:00"
              max="22:00"
              value={typingStart ?? startTime}
              onChange={(e) => {
                const newStartRaw = e.target.value
                setTypingStart(newStartRaw)

                // Compute delta
                const oldStartMinutes = parseInt(startTime.slice(0, 2)) * 60 + parseInt(startTime.slice(3))
                const oldEndMinutes = parseInt(endTime.slice(0, 2)) * 60 + parseInt(endTime.slice(3))
                setStartDelta(oldEndMinutes - oldStartMinutes)
              }}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500
                dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100
                ${invalidField === "start" ? "border-red-500" : ""}`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">End Time</label>
            <input
              type="time"
              min="07:00"
              max="22:00"
              value={typingEnd ?? endTime}
              onChange={(e) => setTypingEnd(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500
                dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100
                ${invalidField === "end" ? "border-red-500" : ""}`}
            />
          </div>
        </div>

        {timeWarning && <div className="text-red-500 text-xs mt-1">{timeWarning}</div>}

        <button
          onClick={() => fetchData()}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "Loading…" : "Search"}
        </button>
      </div>

      {/* Free Rooms Per Building */}
      <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Free Rooms Per Building</h2>
      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600 mb-6 text-gray-900 dark:text-gray-100">
        <thead className="bg-gray-800 text-white">
          <tr>
            <th className="px-3 py-2 border">Building</th>
            <th className="px-3 py-2 border">Free Rooms</th>
          </tr>
        </thead>
        <tbody>
          {perBuilding.map((row) => {
            const isSelected = selectedBuilding === row.building
            return (
              <tr
                key={row.building}
                onClick={() => toggleBuilding(row.building)}
                className={`cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  isSelected ? "bg-blue-200 dark:bg-blue-600" : ""
                }`}
              >
                <td className="px-3 py-2 border">{row.building}</td>
                <td className="px-3 py-2 border">{row.free_room_count}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* All Free Rooms / Filtered */}
      <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
        {selectedBuilding ? `Free Rooms in ${selectedBuilding}` : "All Free Rooms"}
      </h2>
      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
        <thead className="bg-gray-800 text-white">
          <tr>
            <th className="px-3 py-2 border text-left">Building</th>
            <th className="px-3 py-2 border text-left">Room Number</th>
            <th className="px-3 py-2 border text-left">Capacity</th>
            <th className="px-3 py-2 border text-left">Room Details</th>
            <th className="px-3 py-2 border text-left">Earliest Booking</th>
          </tr>
        </thead>
        <tbody>
          {filteredRooms.map((room, i) => (
            <tr key={i} className="hover:bg-gray-200 dark:hover:bg-gray-700">
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
                  : "FREE"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
