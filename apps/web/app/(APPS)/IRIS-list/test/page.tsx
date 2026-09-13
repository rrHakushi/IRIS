"use client"

import { IrisPage } from "@/components/iris-page"
import testPageSchema from "./test.json"

/**
 * Render the whole test page using only the JSON schema, nothing else.
 */
export default function IrisPageTestPage() {
    return <IrisPage schema={testPageSchema} canEdit={true} />
}
