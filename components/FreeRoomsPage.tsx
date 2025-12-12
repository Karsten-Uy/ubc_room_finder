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

export default function FreeRoomsPage() {
  // Create Supabase client using anon/public key
  const supabase = createClient() // make sure this uses anon key

  const [selectedDate, setSelectedDate] = useState<string>('')
  const [startTime, setStartTime] = useState<string>('')
  const [endTime, setEndTime] = useState<string>('')

  const [perBuilding, setPerBuilding] = useState<BuildingCount[]>([])
  const [freeRooms, setFreeRooms] = useState<FreeRoom[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Initialize date/time and fetch data
  useEffect(() => {
    setIsClient(true)

    const now = new Date()
    const later = new Date(now.getTime() + 3 * 60 * 60 * 1000)

    const defaultDate = now.toISOString().slice(0, 10)
    const defaultStart = now.toTimeString().slice(0, 5)
    const defaultEnd = later.toTimeString().slice(0, 5)

    setSelectedDate(defaultDate)
    setStartTime(defaultStart)
    setEndTime(defaultEnd)

    fetchData(defaultDate, defaultStart, defaultEnd)
  }, [])

  const fetchData = async (date?: string, start?: string, end?: string) => {
    const d = date ?? selectedDate
    const s = start ?? startTime
    const e = end ?? endTime

    if (!d || !s || !e) {
      alert("Please select date, start time, and end time.")
      return
    }

    const startDateTime = `${d}T${s}`
    const endDateTime = `${d}T${e}`

    if (new Date(endDateTime) <= new Date(startDateTime)) {
      alert("End time must be after start time.")
      return
    }

    setLoading(true)

    const { data: perBuildingData, error: perBuildingErr } =
      await supabase.rpc('free_rooms_per_building', { p_start: startDateTime, p_end: endDateTime })
    const { data: freeRoomsData, error: freeRoomsErr } =
      await supabase.rpc('free_rooms_list', { p_start: startDateTime, p_end: endDateTime })

    if (perBuildingErr || freeRoomsErr) {
      alert(`Query error: ${JSON.stringify(perBuildingErr || freeRoomsErr, null, 2)}`)
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Free Room Search</h1>

      {/* Date/Time Inputs */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          onClick={() => fetchData()}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading…' : 'Search'}
        </button>
      </div>

      {/* Free Rooms Per Building */}
      <h2 className="text-2xl font-bold mb-4">Free Rooms Per Building</h2>
      <table className="w-full mb-10 border-collapse border border-gray-300">
        <thead className="bg-gray-700 text-white">
          <tr>
            <th className="border border-gray-300 px-4 py-2 text-left">Building</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Free Rooms</th>
          </tr>
        </thead>
        <tbody>
          {perBuilding.map((row) => {
            const isSelected = selectedBuilding === row.building
            return (
              <tr
                key={row.building}
                onClick={() => toggleBuilding(row.building)}
                className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-200' : ''}`}
              >
                <td className="border border-gray-300 px-4 py-2">{row.building}</td>
                <td className="border border-gray-300 px-4 py-2">{row.free_room_count}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* All Free Rooms */}
      <h2 className="text-2xl font-bold mb-4">All Free Rooms</h2>
      <table className="w-full border-collapse border border-gray-300">
        <thead className="bg-gray-700 text-white">
          <tr>
            <th className="border border-gray-300 px-4 py-2 text-left">Building</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Room Number</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Capacity</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Features</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Earliest Booking</th>
          </tr>
        </thead>
        <tbody>
          {filteredRooms.map((room, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">{room.building}</td>
              <td className="border border-gray-300 px-4 py-2">{room.room_number}</td>
              <td className="border border-gray-300 px-4 py-2">{room.capacity}</td>
              <td className="border border-gray-300 px-4 py-2">{room.features ?? '—'}</td>
              <td className="border border-gray-300 px-4 py-2">
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
