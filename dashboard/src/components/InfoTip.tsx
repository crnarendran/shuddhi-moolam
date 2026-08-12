import { Info } from 'lucide-react';
import { type ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import { GLOSSARY } from '../lib/help';

/**
 * A small (i) icon that reveals a Tooltip. Pass `content` directly, or
 * `term` to pull the shared definition from the glossary.
 */
export function InfoTip(
  { content, term }: { content?: ReactNode; term?: keyof typeof GLOSSARY }
) {
  const body = content ?? (term ? GLOSSARY[term] : '');
  return (
    <Tooltip content={body}>
      <Info
        className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600
          dark:hover:text-zinc-300"
        aria-label="More information"
      />
    </Tooltip>
  );
}
