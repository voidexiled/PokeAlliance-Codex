import { Section } from '@/components/layout/Section';
import { OperationsPanel } from '@/components/trade/OperationsPanel';

import type { OperationsPageTexts, PageContext } from './types';

// «Mis operaciones» (spec 9.10 with 9.15.4), the body of `/{l}/cuenta/operaciones/` in the account
// frame, a chunk of its own: «Compras» / «Ventas», the table of the deals and the dialogs of each
// action and of the review (OperationsPanel.tsx), with the page's session.

interface OperationsPageProps extends PageContext {
  texts: OperationsPageTexts;
}

export default function OperationsPage({
  client,
  userId,
  locale,
  ui,
  heading,
  texts,
}: OperationsPageProps) {
  return (
    <div className="ac-account-page">
      <Section id="cuenta-operaciones" title={heading}>
        <OperationsPanel
          client={client}
          userId={userId}
          locale={locale}
          messages={texts.messages}
          review={texts.review}
          channels={texts.channels}
          ui={ui}
        />
      </Section>
    </div>
  );
}
