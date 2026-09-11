import { ArrowRightIcon, type LucideIcon } from 'lucide-react';

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type PortalLink = {
  title: string;
  description?: string;
  href: string;
  meta?: string | number;
  icon: LucideIcon;
};

type Props = {
  title: string;
  icon: LucideIcon;
  links: PortalLink[];
  count?: string | number;
};

export function WikiPortalPanel({ title, icon: Icon, links, count }: Props) {
  return (
    <Card size="sm" className="wiki-index-card rounded-md">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Icon aria-hidden="true" />
          {title}
        </CardTitle>
        {count !== undefined && <CardAction className="wiki-index-count">{count}</CardAction>}
      </CardHeader>
      <CardContent className="wiki-index-card-content">
        {links.map(({ title: linkTitle, description, href, meta, icon: LinkIcon }) => (
          <a className="wiki-index-link" href={href} key={`${href}-${linkTitle}`}>
            <LinkIcon aria-hidden="true" />
            <span className="min-w-0">
              <strong>{linkTitle}</strong>
              {description && <small>{description}</small>}
            </span>
            {meta !== undefined ? (
              <span className="wiki-index-link-meta">{meta}</span>
            ) : (
              <ArrowRightIcon aria-hidden="true" />
            )}
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
