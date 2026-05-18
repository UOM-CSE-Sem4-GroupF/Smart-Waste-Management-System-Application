import {
  Users,
  MessageSquareWarning,
  Star,
  PhoneCall,
  FileText,
  Bell,
  MapPinned,
  ClipboardList,
  Construction,
} from 'lucide-react'

interface FeatureCardProps {
  icon:        React.ElementType
  title:       string
  description: string
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5 shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <div className="mt-auto pt-1">
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Construction className="h-2.5 w-2.5" />
          Coming Soon
        </span>
      </div>
    </div>
  )
}

const FEATURES: FeatureCardProps[] = [
  {
    icon:        MessageSquareWarning,
    title:       'Customer Complaints',
    description: 'View, track and resolve complaints submitted by residents. Assign priority levels, link to zones and monitor resolution status.',
  },
  {
    icon:        Users,
    title:       'Customer Directory',
    description: 'Browse and manage registered customer accounts — household and commercial. View contact info, zone assignments and service history.',
  },
  {
    icon:        Star,
    title:       'Service Ratings',
    description: 'Aggregate satisfaction ratings per zone and collection job. Spot underperforming routes and flag recurring feedback patterns.',
  },
  {
    icon:        PhoneCall,
    title:       'Support Requests',
    description: 'Centralised inbox for phone and web support tickets. Categorise by type — missed collection, bin damage, billing or general enquiry.',
  },
  {
    icon:        MapPinned,
    title:       'Zone Service Map',
    description: 'Customer-facing zone map showing scheduled collection days, active disruptions and real-time job status per area.',
  },
  {
    icon:        Bell,
    title:       'Notification Preferences',
    description: 'Manage push, email and SMS notification settings per customer — collection reminders, urgent alerts and job status updates.',
  },
  {
    icon:        FileText,
    title:       'Billing & Invoices',
    description: 'View service invoices, payment history and outstanding balances for commercial customers. Export statements as PDF.',
  },
  {
    icon:        ClipboardList,
    title:       'Audit & Reports',
    description: 'Generate customer-level service reports — collections completed, missed pickups, complaint resolution times and SLA compliance.',
  },
]

export default function CustomerPortalPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Customer Portal</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage customer accounts, complaints, ratings, and service interactions.
        </p>
      </div>

      {/* Coming soon notice */}
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Construction className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">Customer Portal is under development</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              We&apos;re building a full customer management suite — complaints, directory, ratings,
              billing and real-time service notifications. All sections are planned and will be
              available in an upcoming release.
            </p>
          </div>
        </div>
      </div>

      {/* Feature grid */}
      <div>
        <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          Planned Features
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </div>
  )
}
