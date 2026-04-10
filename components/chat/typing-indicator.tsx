// Animated "assistant is typing" indicator — three bouncing dots
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2" aria-label="Assistant is typing">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  )
}
