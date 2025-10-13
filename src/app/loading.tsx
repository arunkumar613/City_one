import { Wifi } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="relative">
        <Wifi className="h-16 w-16 text-primary" />
        <div className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/50"></div>
        <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-primary/30"></div>
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">City Pulse</h1>
      <p className="text-muted-foreground">Vanakkam, Chennai! Loading live data...</p>
    </div>
  );
}
