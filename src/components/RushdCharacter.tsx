import { motion } from 'framer-motion'
import { Icon } from './Icon'

type Mood = 'calm' | 'happy' | 'thinking' | 'celebrate'

type RushdCharacterProps = {
  mood?: Mood
  size?: 'sm' | 'md' | 'lg'
  message?: string
  interactive?: boolean
  onPress?: () => void
}

export function RushdCharacter({
  mood = 'calm',
  size = 'md',
  message,
  interactive = false,
  onPress,
}: RushdCharacterProps) {
  return (
    <div className={`rushd-character-wrap rushd-${size} rushd-mood-${mood}`}>
      {message && (
        <motion.div
          className="rushd-bubble"
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          key={message}
          role="status"
        >
          {message}
        </motion.div>
      )}
      <motion.button
        type="button"
        aria-label="تفاعل مع رُشد"
        className="rushd-character"
        onClick={onPress}
        disabled={!interactive}
        animate={{
          y: [0, -6, 0],
          rotate: mood === 'celebrate' ? [0, -3, 3, 0] : [0, 1.2, 0, -1.2, 0],
        }}
        transition={{
          y: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: mood === 'celebrate' ? 1.1 : 7.5, repeat: Infinity, ease: 'easeInOut' },
        }}
        whileTap={interactive ? { scale: 0.94 } : undefined}
      >
        <span className="rushd-image-glow" aria-hidden="true" />
        <img src="/brand/rushd-mascot-v2.png" alt="" width="760" height="688" draggable="false" />
        {mood === 'celebrate' && <span className="rushd-sparkles"><Icon name="spark" size={19} /></span>}
        {mood === 'thinking' && <span className="rushd-thought">؟</span>}
      </motion.button>
    </div>
  )
}
