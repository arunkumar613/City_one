"use client";

import type { Incident, CivicIssue, Event } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { MapPin, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type Feature = Incident | CivicIssue | Event;

interface IncidentSheetProps {
  feature: Feature | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const severityVariantMap: Record<string, "destructive" | "secondary" | "default" | "outline"> = {
    'Critical': 'destructive',
    'Major': 'secondary',
    'Minor': 'default',
    'Info': 'outline'
};

const getFeatureTitle = (feature: Feature): string => {
  if ('type' in feature) return feature.type;
  if ('category' in feature) return feature.category;
  if ('name' in feature) return feature.name;
  return "Details";
};

const getTimestamp = (feature: Feature): string | null => {
  if ('timestamp' in feature) return feature.timestamp;
  if ('updatedAt' in feature) return feature.updatedAt;
  if ('startTime' in feature) return feature.startTime;
  return null;
}

export function IncidentSheet({ feature, isOpen, onOpenChange }: IncidentSheetProps) {
  if (!feature) return null;

  const title = getFeatureTitle(feature);
  const timestamp = getTimestamp(feature);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="bg-background/80 backdrop-blur-sm text-foreground border-t border-border/50 max-h-[80vh] flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="text-2xl font-headline truncate">{title}</SheetTitle>
          <SheetDescription className="flex items-center gap-4 text-sm">
            {'ward' in feature && <span className="flex items-center gap-1"><MapPin className="size-3" />{feature.ward}</span>}
            {timestamp && <span className="flex items-center gap-1"><Clock className="size-3" />{formatDistanceToNow(new Date(timestamp), { addSuffix: true })}</span>}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto">
            <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="media" disabled={!('mediaUrls' in feature) || feature.mediaUrls.length === 0}>Media</TabsTrigger>
                <TabsTrigger value="directions">Directions</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="p-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                    {'severity' in feature && <Badge variant={severityVariantMap[feature.severity] || 'default'} className="flex items-center gap-1"><AlertTriangle className="size-3" />{feature.severity}</Badge>}
                    {'status' in feature && <Badge variant="outline">{feature.status}</Badge>}
                </div>
                <p className="text-base">
                    {'description' in feature ? feature.description : 'No description available.'}
                </p>
                {'predictedDensity' in feature && (
                    <div className="space-y-2">
                        <h4 className="font-semibold">Predicted Crowd Density</h4>
                        <div className="w-full bg-muted rounded-full h-2.5">
                            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${feature.predictedDensity * 100}%` }}></div>
                        </div>
                        <p className="text-sm text-muted-foreground">{Math.round(feature.predictedDensity * 100)}% density expected</p>
                    </div>
                )}
            </TabsContent>
            <TabsContent value="media" className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {'mediaUrls' in feature && feature.mediaUrls.map((url, index) => (
                        <div key={index} className="relative aspect-video rounded-lg overflow-hidden">
                        <Image src={url} alt={`${title} media ${index + 1}`} fill style={{ objectFit: 'cover' }} data-ai-hint="incident photo" />
                        </div>
                    ))}
                </div>
            </TabsContent>
            <TabsContent value="directions" className="p-4 flex flex-col items-center justify-center text-center space-y-4 h-48">
                <p className="text-muted-foreground">Get directions to this location.</p>
                <Button asChild>
                    <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${feature.location.coordinates[1]},${feature.location.coordinates[0]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open in Google Maps
                        <ExternalLink className="ml-2 size-4" />
                    </a>
                </Button>
            </TabsContent>
            </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
