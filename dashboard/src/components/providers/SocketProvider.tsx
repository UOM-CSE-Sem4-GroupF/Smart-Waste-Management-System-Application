'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { type Socket } from 'socket.io-client'
import { getSocket } from '@/lib/socket'
import { useSession } from 'next-auth/react'
import { useBinStore } from '@/store/binStore'
import { useVehicleStore } from '@/store/vehicleStore'
import { useAlertStore } from '@/store/alertStore'
import { useJobStore } from '@/store/jobStore'

const SocketContext = createContext<Socket | null>(null)

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  // useState (not useRef) — state change triggers re-render so consumers of
  // useSocket() receive the live socket instance once it connects, not null.
  const [socket, setSocket] = useState<Socket | null>(null)

  const updateBin         = useBinStore((s) => s.updateBin)
  const updateZone        = useBinStore((s) => s.updateZone)
  const updateVehicle     = useVehicleStore((s) => s.updateVehicle)
  const addAlert          = useAlertStore((s) => s.addAlert)
  const updateJob         = useJobStore((s) => s.updateJob)
  const addJob            = useJobStore((s) => s.addJob)
  const updateJobProgress = useJobStore((s) => s.updateJobProgress)

  useEffect(() => {
    // Connect even without session for bypass
    const token = session?.accessToken ?? 'bypass-token'
    const sock = getSocket(token)

    // Use connect/disconnect events instead of synchronous setState in effect body
    // (synchronous setState triggers cascading renders — React warning)
    const onConnect    = () => setSocket(sock)
    const onDisconnect = () => setSocket(null)
    sock.on('connect',    onConnect)
    sock.on('disconnect', onDisconnect)
    // Already connected (e.g. token refresh) — defer to avoid sync setState
    if (sock.connected) queueMicrotask(() => setSocket(sock))

    // ── Bin and zone events (from Bin Status Service via Kafka) ──
    sock.on('bin:update',   (payload) => updateBin(payload))
    sock.on('zone:stats',   (payload) => updateZone(payload))
    sock.on('alert:urgent', (payload) => addAlert({ ...payload, type: 'urgent' }))

    // ── Vehicle events (from Scheduler Service via Kafka) ──────
    sock.on('vehicle:position', (payload) => updateVehicle(payload))
    sock.on('job:progress',     (payload) => updateJobProgress(payload))

    // ── Job lifecycle events (from Orchestrator via HTTP) ──────
    sock.on('job:created',   (payload) => addJob(payload))
    sock.on('job:completed', (payload) => updateJob(payload.job_id, { state: 'COMPLETED', ...payload }))
    sock.on('job:cancelled', (payload) => updateJob(payload.job_id, { state: 'CANCELLED', ...payload }))
    sock.on('alert:escalated', (payload) => addAlert({ ...payload, type: 'escalated' }))

    // ── Alert events (from Scheduler via HTTP) ─────────────────
    sock.on('alert:deviation',    (payload) => addAlert({ ...payload, type: 'deviation' }))
    sock.on('alert:weight-limit', (payload) => addAlert({ ...payload, type: 'weight-limit' }))

    return () => {
      sock.off('connect',    onConnect)
      sock.off('disconnect', onDisconnect)
      sock.off('bin:update')
      sock.off('zone:stats')
      sock.off('alert:urgent')
      sock.off('vehicle:position')
      sock.off('job:progress')
      sock.off('job:created')
      sock.off('job:completed')
      sock.off('job:cancelled')
      sock.off('alert:escalated')
      sock.off('alert:deviation')
      sock.off('alert:weight-limit')
    }
  // Zustand store actions are stable references (never change), so omitting them
  // from deps is intentional — we only want to reconnect when the token changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
