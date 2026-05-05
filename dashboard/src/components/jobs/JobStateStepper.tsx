import { cn } from '@/lib/utils'
import type { JobState } from '@/types'

// Ordered phases for the stepper
const PHASES: JobState[][] = [
  ['CREATED', 'BIN_CONFIRMING', 'BIN_CONFIRMED'],
  ['CLUSTER_ASSEMBLING', 'CLUSTER_ASSEMBLED'],
  ['DISPATCHING', 'DISPATCHED', 'DRIVER_NOTIFIED'],
  ['IN_PROGRESS', 'COMPLETING', 'COLLECTION_DONE'],
  ['RECORDING_AUDIT', 'AUDIT_RECORDED', 'COMPLETED'],
]

const ALL_ORDERED: JobState[] = PHASES.flat()

const TERMINAL_FAILURE: JobState[] = ['FAILED', 'ESCALATED', 'CANCELLED', 'AUDIT_FAILED']
const TERMINAL_SPLIT:   JobState[] = ['SPLIT_JOB']

function getStepStatus(state: JobState, stepState: JobState): 'completed' | 'current' | 'failed' | 'pending' {
  if (TERMINAL_FAILURE.includes(state)) {
    // All steps up to the current are failed, rest are pending
    const stepIdx  = ALL_ORDERED.indexOf(stepState)
    const currIdx  = ALL_ORDERED.indexOf(state)
    if (stepIdx <= currIdx) return 'failed'
    return 'pending'
  }
  const stepIdx = ALL_ORDERED.indexOf(stepState)
  const currIdx = ALL_ORDERED.indexOf(state)
  if (currIdx === -1) return 'pending'          // terminal/split not in ordered list
  if (stepIdx < currIdx)  return 'completed'
  if (stepIdx === currIdx) return 'current'
  return 'pending'
}

const DOT_STYLES = {
  completed: 'bg-green-500 ring-green-200 dark:ring-green-900',
  current:   'bg-blue-500 ring-blue-200 dark:ring-blue-900 ring-4',
  failed:    'bg-red-500 ring-red-200 dark:ring-red-900',
  pending:   'bg-muted-foreground/30',
}

const LINE_STYLES = {
  completed: 'bg-green-500',
  failed:    'bg-red-400',
  pending:   'bg-border',
}

interface JobStateStepperProps {
  state: JobState
}

export function JobStateStepper({ state }: JobStateStepperProps) {
  const isFailure = TERMINAL_FAILURE.includes(state)
  const isSplit   = TERMINAL_SPLIT.includes(state)

  return (
    <div className="w-full space-y-4">
      {/* Special terminal banners */}
      {isFailure && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400">
          Terminal state: {state.replace('_', ' ')}
        </div>
      )}
      {isSplit && (
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
          Job was split — watch for child job:created events
        </div>
      )}

      {/* Phase rows */}
      <div className="flex w-full items-center gap-0">
        {PHASES.map((phase, phaseIdx) => (
          <div key={phaseIdx} className="flex flex-1 items-center">
            {/* Steps within phase */}
            {phase.map((stepState, stepIdx) => {
              const status = getStepStatus(state, stepState)
              return (
                <div key={stepState} className="flex flex-1 items-center">
                  {/* Dot + label */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'h-3 w-3 rounded-full ring-2 ring-background transition-all',
                        DOT_STYLES[status],
                      )}
                      title={stepState}
                    />
                    <span className="mt-1 max-w-[64px] text-center text-[9px] leading-tight text-muted-foreground">
                      {stepState.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {/* Connector line (not after last step in last phase) */}
                  {!(phaseIdx === PHASES.length - 1 && stepIdx === phase.length - 1) && (
                    <div
                      className={cn(
                        'h-0.5 flex-1',
                        status === 'completed' ? LINE_STYLES.completed :
                        status === 'failed'    ? LINE_STYLES.failed :
                                                 LINE_STYLES.pending,
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
