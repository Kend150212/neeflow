import { redirect } from 'next/navigation'

// Redirect old URL to new SmartFlow page
export default function ContentPipelineRedirect() {
    redirect('/dashboard/smartflow')
}
