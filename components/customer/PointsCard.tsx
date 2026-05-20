interface PointsCardProps {
  points: number
  username: string
  phone: string
}

export default function PointsCard({ points, username, phone }: PointsCardProps) {
  return (
    <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-6 text-white shadow-lg">
      <p className="text-brand-200 text-sm font-medium">{username}</p>
      <p className="text-brand-300 text-xs mb-4">{phone}</p>
      <div className="text-center">
        <p className="text-brand-200 text-sm uppercase tracking-widest mb-1">Your Points</p>
        <p className="text-6xl font-bold tracking-tight">{points.toLocaleString()}</p>
        <p className="text-brand-300 text-sm mt-1">pts</p>
      </div>
    </div>
  )
}
