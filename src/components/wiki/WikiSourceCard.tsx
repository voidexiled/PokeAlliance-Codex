import { ArrowUpRightIcon, DatabaseIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { SourceRecord } from '@/lib/content/types';

type Copy = {
  authority: string;
  scope: string;
  checked: string;
  evidence: string;
  open: string;
  local: string;
};

type Props = {
  source: SourceRecord;
  evidenceCount: number;
  copy: Copy;
};

export function WikiSourceCard({ source, evidenceCount, copy }: Props) {
  const external = source.url.startsWith('http');

  return (
    <Card id={source.id.replaceAll(':', '-')} size="sm" className="wiki-source-card rounded-md">
      <CardHeader className="border-b">
        <p className="eyebrow">{source.sourceType.replaceAll('_', ' ')}</p>
        <CardTitle>{source.name}</CardTitle>
        <CardAction>
          <Badge variant="outline">{source.authority.replaceAll('_', ' ')}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="wiki-source-card-content">
        <p className="wiki-source-note">{source.notes}</p>
        <dl className="wiki-source-facts">
          <div>
            <dt>{copy.authority}</dt>
            <dd>{source.authority.replaceAll('_', ' ')}</dd>
          </div>
          <div>
            <dt>{copy.checked}</dt>
            <dd>
              <time dateTime={source.lastCheckedAt}>{source.lastCheckedAt.slice(0, 10)}</time>
            </dd>
          </div>
          <div>
            <dt>{copy.scope}</dt>
            <dd>{source.scope.join(' · ')}</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="wiki-source-card-footer">
        <span>
          <DatabaseIcon data-icon="inline-start" />
          {evidenceCount} {copy.evidence}
        </span>
        {external ? (
          <a href={source.url} target="_blank" rel="noreferrer">
            {copy.open}
            <ArrowUpRightIcon aria-hidden="true" />
          </a>
        ) : (
          <span>{copy.local}</span>
        )}
      </CardFooter>
    </Card>
  );
}
