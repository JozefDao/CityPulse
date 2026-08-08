import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const highlights = [
  {
    title: 'Explore weather as guest',
    description: 'Open dashboard instantly, search cities, and inspect forecast + air quality without registration.',
  },
  {
    title: 'Unlock account features',
    description: 'Save cities to watchlist, create weather alerts, and keep your profile and preferences in sync.',
  },
  {
    title: 'Read creator guides',
    description: 'Access article feeds, comments, likes, and creator profiles after login.',
  },
];

export function LandingPage() {
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-sky-100 via-cyan-50 to-white p-6 md:p-8">
          <Badge variant="secondary" className="mb-3">
            Weather platform
          </Badge>
          <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
            Weather, air quality, and city insights in one clean workflow.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Start in guest mode, then log in when you want personalized alerts, saved cities, and guides.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/dashboard"
              className="rounded-md border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Open dashboard
            </Link>
            <Link
              to="/login"
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Register
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {highlights.map((item) => (
          <Card key={item.title} className="h-full">
            <CardHeader>
              <CardTitle className="text-base">{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ready to continue?</CardTitle>
          <CardDescription>
            Guests can browse weather data. Logged-in users get full product features.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            to="/dashboard"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Continue as guest
          </Link>
          <Link
            to="/register"
            className="rounded-md border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Register to unlock features
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
