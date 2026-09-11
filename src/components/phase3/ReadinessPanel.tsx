import { ArrowUpRight, Database, MapPinned, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Locale } from '@/i18n/config';

interface ReadinessPanelProps {
  locale: Locale;
}

const copy = {
  es: {
    eyebrow: 'Núcleo operativo',
    title: 'La base para jugar con contexto.',
    description:
      'Una superficie comunitaria rápida, verificable y preparada para crecer desde datos reales: Pokédex, guías, mapa y herramientas.',
    primaryAction: 'Abrir Pokédex',
    secondaryAction: 'Ver sistemas',
    status: 'Fundación lista',
    cards: [
      {
        label: 'Datos',
        title: 'Modelo con provenance',
        description:
          'Cada afirmación puede conservar fuente, estado, fecha y versión del normalizador.',
        icon: Database,
      },
      {
        label: 'Mapa',
        title: 'Coordenadas del juego',
        description:
          'x/y/z, pisos y marcadores observados separados de las etiquetas todavía pendientes.',
        icon: MapPinned,
      },
      {
        label: 'Confianza',
        title: 'Correcciones trazables',
        description:
          'Los conflictos y contribuciones quedan visibles antes de convertirse en conocimiento publicado.',
        icon: ShieldCheck,
      },
    ],
  },
  en: {
    eyebrow: 'Operational core',
    title: 'A better way to play with context.',
    description:
      'A fast, verifiable community surface built to grow from real data: Pokédex, guides, map and tools.',
    primaryAction: 'Open Pokédex',
    secondaryAction: 'View systems',
    status: 'Foundation ready',
    cards: [
      {
        label: 'Data',
        title: 'Provenance-first model',
        description: 'Every claim can retain its source, state, date and normalizer version.',
        icon: Database,
      },
      {
        label: 'Map',
        title: 'Game coordinates',
        description:
          'x/y/z, floors and observed markers stay separate from labels still awaiting review.',
        icon: MapPinned,
      },
      {
        label: 'Trust',
        title: 'Traceable corrections',
        description:
          'Conflicts and contributions remain visible before becoming published knowledge.',
        icon: ShieldCheck,
      },
    ],
  },
} as const;

export function ReadinessPanel({ locale }: ReadinessPanelProps) {
  const content = copy[locale];

  return (
    <section
      className="flex flex-col gap-8"
      data-testid="readiness-panel"
      aria-labelledby="readiness-title"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-panel px-6 py-8 shadow-2xl shadow-black/10 lg:px-10 lg:py-12">
        <div
          className="data-grid pointer-events-none absolute inset-y-0 right-0 w-3/5"
          aria-hidden="true"
        />
        <div className="relative flex max-w-3xl flex-col gap-5">
          <Badge variant="outline" className="w-fit border-primary/40 bg-primary/8 text-primary">
            <span className="status-dot" aria-hidden="true" />
            {content.status}
          </Badge>
          <p className="eyebrow">{content.eyebrow}</p>
          <h1 id="readiness-title" className="display-title max-w-2xl">
            {content.title}
          </h1>
          <p className="muted-copy text-base leading-7">{content.description}</p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a className={buttonVariants({ size: 'lg' })} href={`/${locale}/pokedex/`}>
              {content.primaryAction}
              <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
            </a>
            <a
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
              href={`/${locale}/sistemas/`}
            >
              {content.secondaryAction}
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {content.cards.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label} size="sm" className="bg-panel/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="text-accent" aria-hidden="true" />
                  {item.title}
                </CardTitle>
                <CardDescription>{item.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
              </CardContent>
              <CardFooter className="justify-between">
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.13em] text-muted-foreground">
                  Phase 3
                </span>
                <span className="text-accent" aria-hidden="true">
                  ↗
                </span>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Separator />
    </section>
  );
}
