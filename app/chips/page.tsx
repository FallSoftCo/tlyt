import { redirect } from 'next/navigation'

export default async function ChipsPage() {
  // Redirect to home page - chip purchasing now handled via sheet
  redirect('/')
}