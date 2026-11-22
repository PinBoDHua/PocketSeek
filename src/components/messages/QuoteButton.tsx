import { useTranslate } from '../../i18n/index.js'
import { IconQuoteOutline16 } from '../base/actionIcons.js'
import { IconButton } from '../base/IconButton.js'
import { quoteMessageText } from './quote.js'

export const QuoteButton = ({ sessionId, text }: { sessionId: string; text: string }) => {
  const t = useTranslate()
  return (
    <IconButton
      icon={<IconQuoteOutline16 />}
      tooltip={t('quote')}
      tooltipPlacement="bottom"
      onClick={() => quoteMessageText(sessionId, text)}
    />
  )
}
