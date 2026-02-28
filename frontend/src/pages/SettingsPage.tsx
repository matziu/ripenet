import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { backupApi } from '@/api/endpoints'
import { toast } from 'sonner'
import { Download, Upload, AlertTriangle } from 'lucide-react'

export function SettingsPage() {
  const [replaceAll, setReplaceAll] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const downloadMutation = useMutation({
    mutationFn: () => backupApi.download(),
    onSuccess: (res) => {
      const blob = new Blob([res.data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ripenet-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup downloaded')
    },
    onError: () => toast.error('Failed to download backup'),
  })

  const uploadMutation = useMutation({
    mutationFn: ({ file, replace }: { file: File; replace: boolean }) =>
      backupApi.upload(file, replace),
    onSuccess: (res) => {
      toast.success(res.data.detail)
      setSelectedFile(null)
      setConfirmOpen(false)
      if (fileRef.current) fileRef.current.value = ''
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Import failed'
      toast.error(message)
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file')
      return
    }
    setSelectedFile(file)
    setConfirmOpen(true)
  }

  const handleImport = () => {
    if (!selectedFile) return
    uploadMutation.mutate({ file: selectedFile, replace: replaceAll })
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-8">
      <h1 className="text-lg font-semibold">Settings</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Data Backup</h2>
        <p className="text-xs text-muted-foreground">
          Download all application data (projects, sites, VLANs, subnets, hosts, tunnels, DHCP pools, users, audit log) as a JSON file.
        </p>
        <button
          onClick={() => downloadMutation.mutate()}
          disabled={downloadMutation.isPending}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloadMutation.isPending ? 'Downloading...' : 'Download backup'}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Restore Data</h2>
        <p className="text-xs text-muted-foreground">
          Import data from a previously downloaded backup file.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent/80 file:cursor-pointer"
        />

        {confirmOpen && selectedFile && (
          <div className="rounded-md border border-border p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-medium">Import "{selectedFile.name}"?</p>
                <p className="text-muted-foreground">
                  This will load data into the database. Existing records with the same IDs will be updated.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={replaceAll}
                onChange={(e) => setReplaceAll(e.target.checked)}
                className="rounded"
              />
              <span className="text-destructive font-medium">Replace all data</span>
              <span className="text-muted-foreground">— deletes everything before import</span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={uploadMutation.isPending}
                className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploadMutation.isPending ? 'Importing...' : 'Import'}
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false)
                  setSelectedFile(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
