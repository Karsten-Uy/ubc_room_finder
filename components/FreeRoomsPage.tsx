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
}

export default function FreeRoomsPage() {
  const supabase = createClient()

  // Helper function to format date for datetime-local input
  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // Initialize with current time and +3 hours
  const [startTime, setStartTime] = useState<string>('')
  const [endTime, setEndTime] = useState<string>('')

  const [perBuilding, setPerBuilding] = useState<BuildingCount[]>([])
  const [freeRooms, setFreeRooms] = useState<FreeRoom[]>([])

  const [loading, setLoading] = useState<boolean>(false)

  // Set default times on component mount
  useEffect(() => {
      const now = new Date()
      const later = new Date(now.getTime() + 3 * 60 * 60 * 1000) // +3 hours
      
      setStartTime(formatDateTimeLocal(now))
      setEndTime(formatDateTimeLocal(later))
    }, [])

    const fetchData = async () => {
    if (!startTime || !endTime) {
      alert("Enter both start and end times.")
      return
    }

    setLoading(true)

    console.log("Fetching with:", { startTime, endTime })

    const { data: perBuildingData, error: perBuildingErr } =
      await supabase.rpc('free_rooms_per_building', {
        p_start: startTime,
        p_end: endTime
      })

    console.log("perBuilding response:", { data: perBuildingData, error: perBuildingErr })

    const { data: freeRoomsData, error: freeRoomsErr } =
      await supabase.rpc('free_rooms_list', {
        p_start: startTime,
        p_end: endTime
      })

    console.log("freeRooms response:", { data: freeRoomsData, error: freeRoomsErr })

    if (perBuildingErr || freeRoomsErr) {
      console.error("Full error details:", perBuildingErr || freeRoomsErr)
      alert(`Query error: ${JSON.stringify(perBuildingErr || freeRoomsErr, null, 2)}`)
      setLoading(false)
      return
    }

    setPerBuilding(perBuildingData ?? [])
    setFreeRooms(freeRoomsData ?? [])

    setLoading(false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Free Room Finder</h1>

      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Start Time</label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">End Time</label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button 
          onClick={fetchData} 
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading…' : 'Search'}
        </button>
      </div>

      <h2 className="text-2xl font-bold mb-4">Free Rooms Per Building</h2>

      <table className="w-full mb-10 border-collapse border border-gray-300">
        <thead className="bg-gray-700 text-white">
          <tr>
            <th className="border border-gray-300 px-4 py-2 text-left">Building</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Free Rooms</th>
          </tr>
        </thead>
        <tbody>
          {perBuilding.map((row) => (
            <tr key={row.building} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">{row.building}</td>
              <td className="border border-gray-300 px-4 py-2">{row.free_room_count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-2xl font-bold mb-4">All Free Rooms</h2>

      <table className="w-full border-collapse border border-gray-300">
        <thead className="bg-gray-700 text-white">
          <tr>
            <th className="border border-gray-300 px-4 py-2 text-left">Room</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Building</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Capacity</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Features</th>
          </tr>
        </thead>
        <tbody>
          {freeRooms.map((room, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">{room.room_number}</td>
              <td className="border border-gray-300 px-4 py-2">{room.building}</td>
              <td className="border border-gray-300 px-4 py-2">{room.capacity}</td>
              <td className="border border-gray-300 px-4 py-2">{room.features ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}