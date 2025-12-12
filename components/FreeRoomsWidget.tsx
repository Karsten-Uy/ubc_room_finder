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

  useEffect(() => {
    setIsClient(true)
    const now = new Date()
    const later = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    setSelectedDate(now.toISOString().slice(0, 10))
    setStartTime(now.toTimeString().slice(0, 5))
    setEndTime(later.toTimeString().slice(0, 5))
    fetchData(
      now.toISOString().slice(0, 10),
      now.toTimeString().slice(0, 5),
      later.toTimeString().slice(0, 5)
    )
  }, [])

  const fetchData = async (date?: string, start?: string, end?: string) => {
    const d = date ?? selectedDate
    const s = start ?? startTime
    const e = end ?? endTime
    if (!d || !s || !e) return

    const startDateTime = `${d}T${s}`
    const endDateTime = `${d}T${e}`

    if (new Date(endDateTime) <= new Date(startDateTime)) return
    setLoading(true)

    const { data: perBuildingData, error: perBuildingErr } =
      await supabase.rpc('free_rooms_per_building', { p_start: startDateTime, p_end: endDateTime })
    const { data: freeRoomsData, error: freeRoomsErr } =
      await supabase.rpc('free_rooms_list', { p_start: startDateTime, p_end: endDateTime })

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

  return (
    <div className="p-6 w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Free Room Finder</h1>

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
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
        </div>
        <button
          onClick={() => fetchData()}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Loading…' : 'Search'}
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
                className={`cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 ${isSelected ? 'bg-blue-200 dark:bg-blue-600' : ''}`}
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
        {selectedBuilding ? `Free Rooms in ${selectedBuilding}` : 'All Free Rooms'}
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
                  ? new Date(room.earliest_booking).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'FREE ALL DAY'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
