import { ChannelsPanel } from '../ChannelsPanel';
import { readSectionTexts } from './texts';
import type { PanelContext } from './types';

// «Canales de contacto» as a section of its own chunk (COMERCIO_PUBLICO only).

interface ChannelsSectionProps extends PanelContext {
  /** A channel changed: «Resumen» and the index read the channels again. */
  onChanged: () => void;
}

export default function ChannelsSection({
  client,
  locale,
  messages,
  panel,
  trade,
  ui,
  onChanged,
}: ChannelsSectionProps) {
  // The texts of the section travel beside the island, not in its props (panel/texts.ts).
  const texts = readSectionTexts()?.channels;
  if (texts === undefined) return null;
  return (
    <ChannelsPanel
      client={client}
      locale={locale}
      messages={messages}
      texts={texts}
      panel={panel}
      labels={trade.channels}
      ui={ui}
      onChanged={onChanged}
    />
  );
}
