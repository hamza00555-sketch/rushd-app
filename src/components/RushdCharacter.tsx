import { motion } from 'framer-motion'

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
  const isHappy = mood === 'happy' || mood === 'celebrate'
  const isThinking = mood === 'thinking'

  return (
    <div className={`rushd-character-wrap rushd-${size}`}>
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
        animate={{ y: [0, -7, 0], rotate: mood === 'celebrate' ? [0, -4, 4, 0] : 0 }}
        transition={{
          y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: 0.6, repeat: mood === 'celebrate' ? Infinity : 0, repeatDelay: 1.3 },
        }}
        whileTap={interactive ? { scale: 0.92 } : undefined}
      >
        <span className="rushd-glow" />
        <span className="rushd-orbit" />
        <span className="rushd-body">
          <span className={`rushd-eye rushd-eye-right ${isHappy ? 'is-happy' : ''}`} />
          <span className={`rushd-eye rushd-eye-left ${isThinking ? 'is-thinking' : ''} ${isHappy ? 'is-happy' : ''}`} />
          <span className={`rushd-mouth ${isHappy ? 'is-happy' : ''}`} />
          <span className="rushd-highlight" />
        </span>
        {mood === 'celebrate' && <span className="rushd-sparkles">✦</span>}
        {mood === 'thinking' && <span className="rushd-thought">؟</span>}
      </motion.button>
    </div>
  )
}
