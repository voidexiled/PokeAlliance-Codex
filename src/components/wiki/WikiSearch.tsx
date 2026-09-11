import { SearchIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';

type Props = {
  action: string;
  label: string;
  placeholder: string;
  initialValue?: string;
  prominent?: boolean;
};

export function WikiSearch({
  action,
  label,
  placeholder,
  initialValue = '',
  prominent = false,
}: Props) {
  return (
    <form
      className="wiki-search-control"
      action={action}
      method="get"
      role="search"
      data-prominent={prominent || undefined}
    >
      <Button type="submit" size="icon-sm" variant="ghost" aria-label={label}>
        <SearchIcon data-icon="inline-start" />
      </Button>
      <label className="sr-only" htmlFor={prominent ? 'home-search' : 'global-search'}>
        {label}
      </label>
      <Input
        id={prominent ? 'home-search' : 'global-search'}
        name="q"
        type="search"
        defaultValue={initialValue}
        placeholder={placeholder}
        autoComplete="off"
      />
      <Kbd>Ctrl K</Kbd>
    </form>
  );
}
