import { PasteButton } from '@/components/paste-button'

interface FooterProps {
  userId: string
}

export function Footer({ userId }: FooterProps) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6 rounded-t-3xl">
      <div className="flex items-center justify-center max-w-[90ch] mx-auto">
        <PasteButton userId={userId} />
      </div>
    </footer>
  )
}