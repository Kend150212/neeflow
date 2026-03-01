import { redirect } from 'next/navigation'

// Redirect old URL to new Client Board page
export default function ContentPipelineRedirect() {
    redirect('/dashboard/client-board')
}
