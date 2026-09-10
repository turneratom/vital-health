import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { getTwinSessionId } from '@/lib/twinSession';
import { LabUploader } from '@/components/LabUploader';

/* ─── Warm Palette ─── */
const WARM = {
  bg: 'rgba(26,24,22,0.7)',
  bgLight: 'rgba(26,24,22,0.4)',
  border: 'rgba(168,155,138,0.12)',
  borderActive: 'rgba(168,155,138,0.25)',
  text: 'rgba(245,240,235,0.9)',
  textMuted: 'rgba(200,190,178,0.6)',
  textFaint: 'rgba(200,190,178,0.35)',
  sage: '#7CB68E',
  sageBg: 'rgba(124,182,142,0.08)',
  sageBorder: 'rgba(124,182,142,0.2)',
  terra: '#E8976C',
  terraBg: 'rgba(232,151,108,0.08)',
  terraBorder: 'rgba(232,151,108,0.2)',
  gold: '#C4A46C',
  goldBg: 'rgba(196,164,108,0.08)',
  goldBorder: 'rgba(196,164,108,0.2)',
  sky: '#6BA3BE',
  skyBg: 'rgba(107,163,190,0.08)',
  skyBorder: 'rgba(107,163,190,0.2)',
  rose: '#D4847A',
  roseBg: 'rgba(212,132,122,0.08)',
  roseBorder: 'rgba(212,132,122,0.2)',
  lavender: '#B08EC6',
  lavenderBg: 'rgba(176,142,198,0.08)',
  lavenderBorder: 'rgba(176,142,198,0.2)',
};

/* ─── Helpers ─── */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/* ─── Friendly Categories ─── */
const CATEGORIES = [
  { id: 'blood-panels', label: 'Blood Work', icon: '🩸', color: WARM.rose, bg: WARM.roseBg, border: WARM.roseBorder },
  { id: 'genetics', label: 'Genetics', icon: '🧬', color: WARM.lavender, bg: WARM.lavenderBg, border: WARM.lavenderBorder },
  { id: 'imaging', label: 'Scans & Images', icon: '📷', color: WARM.sky, bg: WARM.skyBg, border: WARM.skyBorder },
  { id: 'labs', label: 'Lab Results', icon: '🔬', color: WARM.sage, bg: WARM.sageBg, border: WARM.sageBorder },
  { id: 'prescriptions', label: 'Medications', icon: '💊', color: WARM.gold, bg: WARM.goldBg, border: WARM.goldBorder },
  { id: 'other', label: 'Other', icon: '📋', color: WARM.textMuted, bg: WARM.bgLight, border: WARM.border },
] as const;

/* ─── Privacy Badge ─── */
const PrivacyBadge = React.memo(({ status }: { status: string }) => {
  const isSecure = status === 'AES-256-GCM' || status === 'encrypted';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
      style={{
        color: isSecure ? WARM.sage : WARM.rose,
        background: isSecure ? WARM.sageBg : WARM.roseBg,
        border: `1px solid ${isSecure ? WARM.sageBorder : WARM.roseBorder}`,
      }}
    >
      {isSecure ? '🔒' : '⚠️'} {isSecure ? 'Private & Secure' : 'Not Secured'}
    </span>
  );
});
PrivacyBadge.displayName = 'PrivacyBadge';

/* ─── File Type Emoji ─── */
function getFileEmoji(fileType: string): string {
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('image')) return '🖼️';
  if (fileType.includes('csv') || fileType.includes('spreadsheet')) return '📊';
  if (fileType.includes('doc')) return '📝';
  return '📎';
}

/* ─── Document Card (replaces file row) ─── */
const DocumentCard = React.memo(({ file, onDelete }: {
  file: { _id: any; fileName: string; fileType: string; category: string; fileSize: number; encryptionStatus: string; uploadedAt: number; notes?: string };
  onDelete: (id: any) => void;
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const cat = CATEGORIES.find(c => c.id === file.category);
  const emoji = getFileEmoji(file.fileType);

  return (
    <div
      className="group relative rounded-2xl p-4 transition-all duration-300 hover:scale-[1.01]"
      style={{
        background: WARM.bg,
        border: `1px solid ${WARM.border}`,
      }}
    >
      <div className="flex items-start gap-3.5">
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
          style={{
            background: cat?.bg || WARM.bgLight,
            border: `1px solid ${cat?.border || WARM.border}`,
          }}
        >
          {emoji}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-[14px] font-semibold truncate" style={{ color: WARM.text }}>
                {file.fileName}
              </h4>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{ color: cat?.color || WARM.textMuted, background: cat?.bg || WARM.bgLight, border: `1px solid ${cat?.border || WARM.border}` }}
                >
                  {cat?.icon} {cat?.label || file.category}
                </span>
                <span className="text-[11px]" style={{ color: WARM.textFaint }}>
                  {formatBytes(file.fileSize)}
                </span>
                <span className="text-[11px]" style={{ color: WARM.textFaint }}>
                  · {timeAgo(file.uploadedAt)}
                </span>
              </div>
              {file.notes && (
                <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: WARM.textMuted }}>
                  {file.notes}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <PrivacyBadge status={file.encryptionStatus} />
              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                  style={{ background: WARM.roseBg, border: `1px solid ${WARM.roseBorder}` }}
                  title="Remove"
                >
                  <span className="text-sm">🗑️</span>
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { onDelete(file._id); setShowConfirm(false); }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200"
                    style={{ background: WARM.roseBg, border: `1px solid ${WARM.roseBorder}`, color: WARM.rose }}
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-2 py-1 rounded-lg text-[11px] transition-all duration-200"
                    style={{ background: WARM.bgLight, border: `1px solid ${WARM.border}`, color: WARM.textMuted }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
DocumentCard.displayName = 'DocumentCard';

/* ─── Add Record Modal (replaces Upload Modal) ─── */
function AddRecordModal({ onClose, onUpload }: {
  onClose: () => void;
  onUpload: (file: File, category: string, notes: string) => Promise<void>;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState('labs');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      await onUpload(selectedFile, category, notes);
      setUploadComplete(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      console.error('[Library] Save error:', err);
      setUploading(false);
    }
  }, [selectedFile, category, notes, onUpload, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} />
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(32,30,28,0.98)',
          border: `1px solid ${WARM.borderActive}`,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: WARM.border }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${WARM.border}` }}>
          <div>
            <h3 className="text-[17px] font-bold" style={{ color: WARM.text }}>Add a Record</h3>
            <p className="text-[12px] mt-0.5" style={{ color: WARM.textFaint }}>Save a document to your health library</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
            style={{ background: WARM.bgLight, border: `1px solid ${WARM.border}` }}
          >
            <span className="text-sm" style={{ color: WARM.textMuted }}>✕</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {uploadComplete ? (
            <div className="flex flex-col items-center py-10">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mb-4 text-3xl"
                style={{ background: WARM.sageBg, border: `2px solid ${WARM.sageBorder}` }}
              >
                ✅
              </div>
              <span className="text-[16px] font-bold" style={{ color: WARM.sage }}>Saved Successfully!</span>
              <span className="text-[13px] mt-1" style={{ color: WARM.textMuted }}>Your document is safe and private</span>
            </div>
          ) : (
            <>
              {/* Drop Zone */}
              <div
                className="relative rounded-2xl p-8 text-center cursor-pointer transition-all duration-300"
                style={{
                  background: dragOver ? WARM.sageBg : WARM.bgLight,
                  border: `2px dashed ${dragOver ? WARM.sageBorder : selectedFile ? WARM.sageBorder : WARM.border}`,
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.doc,.docx" />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-4">
                    <span className="text-3xl">{getFileEmoji(selectedFile.type)}</span>
                    <div className="text-left">
                      <div className="text-[14px] font-semibold truncate max-w-[220px]" style={{ color: WARM.text }}>{selectedFile.name}</div>
                      <div className="text-[12px] mt-0.5" style={{ color: WARM.textMuted }}>{formatBytes(selectedFile.size)}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                      className="text-[12px] px-2 py-1 rounded-lg"
                      style={{ color: WARM.textMuted, background: WARM.bgLight, border: `1px solid ${WARM.border}` }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl mb-3">📎</div>
                    <div className="text-[14px] font-semibold" style={{ color: WARM.text }}>
                      Tap to choose a file
                    </div>
                    <div className="text-[12px] mt-1" style={{ color: WARM.textFaint }}>
                      or drag and drop here
                    </div>
                    <div className="text-[11px] mt-2" style={{ color: WARM.textFaint }}>
                      PDF, photos, spreadsheets, documents
                    </div>
                  </>
                )}
              </div>

              {/* Category Selector */}
              <div>
                <label className="text-[13px] font-semibold mb-2.5 block" style={{ color: WARM.text }}>
                  What type of record is this?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left transition-all duration-200"
                      style={{
                        background: category === cat.id ? cat.bg : 'transparent',
                        border: `1px solid ${category === cat.id ? cat.border : WARM.border}`,
                        color: category === cat.id ? cat.color : WARM.textMuted,
                      }}
                    >
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-[12px] font-medium">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[13px] font-semibold mb-2 block" style={{ color: WARM.text }}>
                  Add a note <span style={{ color: WARM.textFaint, fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Annual checkup results from Dr. Smith"
                  className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all duration-200"
                  style={{
                    background: WARM.bgLight,
                    border: `1px solid ${WARM.border}`,
                    color: WARM.text,
                  }}
                />
              </div>

              {/* Save Button */}
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="w-full py-3.5 rounded-xl text-[14px] font-bold transition-all duration-300 active:scale-[0.98]"
                style={{
                  background: selectedFile && !uploading
                    ? `linear-gradient(135deg, ${WARM.sage}, ${WARM.sky})`
                    : WARM.bgLight,
                  border: `1px solid ${selectedFile && !uploading ? WARM.sageBorder : WARM.border}`,
                  color: selectedFile && !uploading ? '#fff' : WARM.textFaint,
                  cursor: selectedFile && !uploading ? 'pointer' : 'not-allowed',
                  boxShadow: selectedFile && !uploading ? '0 4px 20px rgba(124,182,142,0.2)' : 'none',
                }}
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: 'transparent' }} />
                    Saving securely...
                  </span>
                ) : (
                  <>🔒 Save to My Library</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Health Marker Card (replaces BloodMarker row) ─── */
const HealthMarkerCard = React.memo(({ label, friendlyName, value, unit, optimal, status }: {
  label: string; friendlyName: string; value: number | null; unit: string; optimal: string; status: 'great' | 'okay' | 'attention';
}) => {
  const display = value !== null && value !== undefined ? value : '\u2014';
  const statusConfig = {
    great: { emoji: '✅', color: WARM.sage, bg: WARM.sageBg, border: WARM.sageBorder, label: 'Looking great' },
    okay: { emoji: '👀', color: WARM.gold, bg: WARM.goldBg, border: WARM.goldBorder, label: 'Worth watching' },
    attention: { emoji: '⚠️', color: WARM.rose, bg: WARM.roseBg, border: WARM.roseBorder, label: 'Needs attention' },
  };
  const s = statusConfig[status];

  return (
    <div
      className="rounded-2xl p-4 transition-all duration-300"
      style={{ background: WARM.bg, border: `1px solid ${WARM.border}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[14px] font-semibold" style={{ color: WARM.text }}>{friendlyName}</div>
          <div className="text-[11px] mt-0.5" style={{ color: WARM.textFaint }}>
            {label} · Healthy range: {optimal}
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
          style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
        >
          {s.emoji} {s.label}
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[28px] font-light font-serif" style={{ color: s.color }}>{display}</span>
        <span className="text-[13px]" style={{ color: WARM.textFaint }}>{unit}</span>
      </div>
    </div>
  );
});
HealthMarkerCard.displayName = 'HealthMarkerCard';

/* ─── Genetic Info Card (replaces GeneticFlag) ─── */
const GeneticInfoCard = React.memo(({ label, friendlyName, description, active }: {
  label: string; friendlyName: string; description: string; active: boolean;
}) => (
  <div
    className="rounded-2xl p-4 transition-all duration-300"
    style={{
      background: WARM.bg,
      border: `1px solid ${active ? WARM.lavenderBorder : WARM.border}`,
    }}
  >
    <div className="flex items-start gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
        style={{ background: active ? WARM.lavenderBg : WARM.bgLight, border: `1px solid ${active ? WARM.lavenderBorder : WARM.border}` }}
      >
        {active ? '🧬' : '➖'}
      </div>
      <div>
        <div className="text-[13px] font-semibold" style={{ color: WARM.text }}>{friendlyName}</div>
        <div className="text-[11px] mt-0.5" style={{ color: WARM.textFaint }}>{label}</div>
        <div className="text-[12px] mt-1.5 leading-relaxed" style={{ color: WARM.textMuted }}>
          {active ? description : 'Not detected — no special action needed.'}
        </div>
        <div
          className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[10px] font-semibold"
          style={{
            color: active ? WARM.lavender : WARM.sage,
            background: active ? WARM.lavenderBg : WARM.sageBg,
            border: `1px solid ${active ? WARM.lavenderBorder : WARM.sageBorder}`,
          }}
        >
          {active ? '🔬 Detected' : '✅ Clear'}
        </div>
      </div>
    </div>
  </div>
));
GeneticInfoCard.displayName = 'GeneticInfoCard';

/* ─── Library Stats ─── */
const LibraryStats = React.memo(({ summary }: { summary: any }) => {
  const stats = [
    { label: 'Documents', value: summary?.totalFiles ?? 0, emoji: '📄', color: WARM.sky },
    { label: 'Storage', value: summary ? formatBytes(summary.totalSize) : '0 B', emoji: '💾', color: WARM.lavender },
    { label: 'Blood Work', value: summary?.hasBloodwork ? 'Added' : 'Not yet', emoji: '🩸', color: summary?.hasBloodwork ? WARM.sage : WARM.gold },
    { label: 'Genetics', value: summary?.hasGenetics ? 'Added' : 'Not yet', emoji: '🧬', color: summary?.hasGenetics ? WARM.sage : WARM.gold },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 mb-5">
      {stats.map(s => (
        <div
          key={s.label}
          className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
          style={{ background: WARM.bg, border: `1px solid ${WARM.border}` }}
        >
          <span className="text-xl">{s.emoji}</span>
          <div>
            <div className="text-[16px] font-semibold font-serif" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px]" style={{ color: WARM.textFaint }}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
});
LibraryStats.displayName = 'LibraryStats';

/* ─── Section Wrapper ─── */
function Section({ title, emoji, children, badge, delay = 0 }: {
  title: string; emoji: string; children: React.ReactNode; badge?: React.ReactNode; delay?: number;
}) {
  return (
    <div
      className="mb-5"
      style={{ animation: `libraryFadeIn 0.5s ease both ${delay}s` }}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <h3 className="text-[15px] font-bold" style={{ color: WARM.text }}>{title}</h3>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BioVaultView — Personal Health Library
   ═══════════════════════════════════════════════════════════════ */
const BioVaultView = () => {
  const [mounted, setMounted] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const sessionId = typeof window !== 'undefined' ? getTwinSessionId() : '';

  // Convex queries
  const bioVault = useQuery(api.queries.getBioVaultBySession, sessionId ? { sessionId } : 'skip');
  const vaultFiles = useQuery(api.vaultFiles.listVaultFiles, sessionId ? { sessionId } : 'skip');
  const vaultSummary = useQuery(api.vaultFiles.getVaultSummary, sessionId ? { sessionId } : 'skip');

  // Mutations
  const generateUploadUrl = useMutation(api.vaultFiles.generateUploadUrl);
  const createVaultFile = useMutation(api.vaultFiles.createVaultFile);
  const deleteVaultFile = useMutation(api.vaultFiles.deleteVaultFile);

  const handleUpload = useCallback(async (file: File, category: string, notes: string) => {
    const uploadUrl = await generateUploadUrl();
    const result = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    const { storageId } = await result.json();

    await createVaultFile({
      sessionId,
      fileName: file.name,
      fileType: file.type,
      category,
      fileSize: file.size,
      storageId,
      notes: notes || undefined,
    });
  }, [sessionId, generateUploadUrl, createVaultFile]);

  const handleDelete = useCallback(async (id: any) => {
    await deleteVaultFile({ id });
  }, [deleteVaultFile]);

  // Filter files by category
  const filteredFiles = useMemo(() => {
    if (!vaultFiles) return [];
    if (!activeCategory) return vaultFiles;
    return vaultFiles.filter((f: any) => f.category === activeCategory);
  }, [vaultFiles, activeCategory]);

  // Blood marker status helper
  const getMarkerStatus = (value: number | null | undefined, low: number, high: number, inverse = false): 'great' | 'okay' | 'attention' => {
    if (value === null || value === undefined) return 'okay';
    if (inverse) return value < low ? 'great' : value < high ? 'okay' : 'attention';
    return value >= low && value <= high ? 'great' : value >= low * 0.8 ? 'okay' : 'attention';
  };

  return (
    <div
      className="font-sans px-4 pb-8 max-w-[800px] mx-auto"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* ── Header ── */}
      <div className="mb-5 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[24px] font-bold" style={{ color: WARM.text, letterSpacing: '-0.02em' }}>
              My Health Library
            </h2>
            <p className="text-[13px] mt-1" style={{ color: WARM.textMuted }}>
              All your health records in one safe place
            </p>
          </div>
          <button
            onClick={() => setShowAddRecord(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13px] font-bold transition-all duration-300 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${WARM.sage}, ${WARM.sky})`,
              color: '#fff',
              boxShadow: '0 4px 16px rgba(124,182,142,0.25)',
            }}
          >
            <span className="text-base">＋</span>
            Add a Record
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <LibraryStats summary={vaultSummary} />

      {/* ── My Documents ── */}
      <Section title="My Documents" emoji="📂" delay={0.05} badge={
        <span className="text-[12px] font-medium" style={{ color: WARM.textFaint }}>
          {vaultFiles?.length ?? 0} saved
        </span>
      }>
        {/* Category Filter */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setActiveCategory(null)}
            className="px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all duration-200"
            style={{
              background: !activeCategory ? WARM.skyBg : 'transparent',
              border: `1px solid ${!activeCategory ? WARM.skyBorder : WARM.border}`,
              color: !activeCategory ? WARM.sky : WARM.textFaint,
            }}
          >
            All
          </button>
          {CATEGORIES.map(cat => {
            const count = vaultFiles?.filter((f: any) => f.category === cat.id).length ?? 0;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all duration-200"
                style={{
                  background: activeCategory === cat.id ? cat.bg : 'transparent',
                  border: `1px solid ${activeCategory === cat.id ? cat.border : WARM.border}`,
                  color: activeCategory === cat.id ? cat.color : WARM.textFaint,
                }}
              >
                {cat.icon} {cat.label} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Document Cards */}
        <div className="space-y-2.5">
          {filteredFiles.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: WARM.bg, border: `1px solid ${WARM.border}` }}
            >
              <div className="text-4xl mb-3">📋</div>
              <div className="text-[14px] font-semibold" style={{ color: WARM.text }}>
                {activeCategory ? 'No records in this category yet' : 'Your library is empty'}
              </div>
              <div className="text-[12px] mt-1" style={{ color: WARM.textMuted }}>
                Add your first health document to get started
              </div>
              <button
                onClick={() => setShowAddRecord(true)}
                className="mt-4 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 active:scale-95"
                style={{ background: WARM.sageBg, border: `1px solid ${WARM.sageBorder}`, color: WARM.sage }}
              >
                ＋ Add a Record
              </button>
            </div>
          ) : (
            filteredFiles.map((file: any) => (
              <DocumentCard key={file._id} file={file} onDelete={handleDelete} />
            ))
          )}
        </div>
      </Section>

      {/* ── Paste Labs → BioVault (QuickSync via LabUploader) ── */}
      <Section title="Paste Lab Results" emoji="⚡" delay={0.08} badge={
        <span className="text-[11px] px-2.5 py-1 rounded-full font-medium" style={{ color: WARM.sky, background: WARM.skyBg, border: `1px solid ${WARM.skyBorder}` }}>
          Quick-Sync
        </span>
      }>
        <div
          className="rounded-2xl p-3 sm:p-4"
          style={{ background: WARM.bg, border: `1px solid ${WARM.border}` }}
        >
          <p className="text-[12px] mb-3 px-1" style={{ color: WARM.textMuted }}>
            Paste Quest/Labcorp text, verify markers, then Sync to Vault under your twin session. Photo AI extract stays Coming Soon.
          </p>
          <LabUploader />
        </div>
      </Section>

      {/* ── Blood Work Results ── */}
      <Section title="Blood Work Results" emoji="🩸" delay={0.1} badge={
        bioVault ? (
          <span className="text-[11px] px-2.5 py-1 rounded-full font-medium" style={{ color: WARM.sage, background: WARM.sageBg, border: `1px solid ${WARM.sageBorder}` }}>
            Updated {bioVault.updatedAt ? timeAgo(bioVault.updatedAt) : 'recently'}
          </span>
        ) : null
      }>
        {bioVault ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <HealthMarkerCard
              label="Vitamin D"
              friendlyName="Vitamin D Level"
              value={bioVault.vitaminD ?? null}
              unit="ng/mL"
              optimal="40–60"
              status={getMarkerStatus(bioVault.vitaminD, 40, 60)}
            />
            <HealthMarkerCard
              label="Free Testosterone"
              friendlyName="Free Testosterone"
              value={bioVault.testosteroneFree ?? null}
              unit="pg/mL"
              optimal="15–25"
              status={getMarkerStatus(bioVault.testosteroneFree, 15, 25)}
            />
            <HealthMarkerCard
              label="Total Testosterone"
              friendlyName="Total Testosterone"
              value={bioVault.testosteroneTotal ?? null}
              unit="ng/dL"
              optimal="500–900"
              status={getMarkerStatus(bioVault.testosteroneTotal, 500, 900)}
            />
            <HealthMarkerCard
              label="Ferritin"
              friendlyName="Iron Stores"
              value={bioVault.ferritin ?? null}
              unit="ng/mL"
              optimal="40–150"
              status={getMarkerStatus(bioVault.ferritin, 40, 150)}
            />
            <HealthMarkerCard
              label="CRP"
              friendlyName="Inflammation Level"
              value={bioVault.crp ?? null}
              unit="mg/L"
              optimal="Below 1.0"
              status={bioVault?.crp !== null && bioVault?.crp !== undefined ? (bioVault.crp < 1 ? 'great' : bioVault.crp < 3 ? 'okay' : 'attention') : 'okay'}
            />
            <HealthMarkerCard
              label="HbA1c"
              friendlyName="Blood Sugar (3-month)"
              value={bioVault.hba1c ?? null}
              unit="%"
              optimal="Below 5.7"
              status={bioVault?.hba1c !== null && bioVault?.hba1c !== undefined ? (bioVault.hba1c < 5.7 ? 'great' : bioVault.hba1c < 6.5 ? 'okay' : 'attention') : 'okay'}
            />
          </div>
        ) : (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: WARM.bg, border: `1px solid ${WARM.border}` }}
          >
            <div className="text-4xl mb-3">🩸</div>
            <div className="text-[14px] font-semibold" style={{ color: WARM.text }}>No blood work added yet</div>
            <div className="text-[12px] mt-1" style={{ color: WARM.textMuted }}>
              Upload your lab results to see your health markers here
            </div>
          </div>
        )}
      </Section>

      {/* ── Genetic Insights ── */}
      <Section title="Genetic Insights" emoji="🧬" delay={0.15} badge={<PrivacyBadge status="AES-256-GCM" />}>
        {bioVault ? (
          <div className="space-y-2.5">
            <GeneticInfoCard
              label="MTHFR Variant"
              friendlyName="Folate Processing"
              description="Your body may need methylated folate (methylfolate) instead of regular folic acid for best results."
              active={bioVault.mthfrVariant}
            />
            <GeneticInfoCard
              label="APOE4 Carrier"
              friendlyName="Heart & Brain Health"
              description="You may benefit from extra focus on heart-healthy fats and regular cognitive exercises."
              active={bioVault.apoe4}
            />
            <GeneticInfoCard
              label="Caffeine Sensitivity"
              friendlyName="Caffeine Response"
              description="Your body processes caffeine slowly — consider limiting intake after noon for better sleep."
              active={bioVault.caffeineSensitivity}
            />
          </div>
        ) : (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: WARM.bg, border: `1px solid ${WARM.border}` }}
          >
            <div className="text-4xl mb-3">🧬</div>
            <div className="text-[14px] font-semibold" style={{ color: WARM.text }}>No genetic data yet</div>
            <div className="text-[12px] mt-1" style={{ color: WARM.textMuted }}>
              Upload your genetic test results to unlock personalized insights
            </div>
          </div>
        )}
      </Section>

      {/* ── Food Preferences ── */}
      {bioVault && (bioVault.preferredProteins || bioVault.dietaryRestrictions) && (
        <Section title="Food Preferences" emoji="🍽️" delay={0.2}>
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ background: WARM.bg, border: `1px solid ${WARM.border}` }}
          >
            {bioVault.preferredProteins && (
              <div>
                <div className="text-[13px] font-semibold mb-2" style={{ color: WARM.text }}>Favorite Proteins</div>
                <div className="flex gap-2 flex-wrap">
                  {bioVault.preferredProteins.split(',').map((p: string) => (
                    <span
                      key={p.trim()}
                      className="px-3 py-1.5 rounded-xl text-[12px] font-medium"
                      style={{ background: WARM.sageBg, border: `1px solid ${WARM.sageBorder}`, color: WARM.sage }}
                    >
                      {p.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {bioVault.dietaryRestrictions && (
              <div>
                <div className="text-[13px] font-semibold mb-2" style={{ color: WARM.text }}>Dietary Notes</div>
                <div className="flex gap-2 flex-wrap">
                  {bioVault.dietaryRestrictions.split(',').map((r: string) => (
                    <span
                      key={r.trim()}
                      className="px-3 py-1.5 rounded-xl text-[12px] font-medium"
                      style={{ background: WARM.goldBg, border: `1px solid ${WARM.goldBorder}`, color: WARM.gold }}
                    >
                      {r.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Privacy Footer ── */}
      <div className="mt-6 text-center">
        <div
          className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl"
          style={{ background: WARM.bg, border: `1px solid ${WARM.border}` }}
        >
          <span className="text-base">🔒</span>
          <span className="text-[12px]" style={{ color: WARM.textMuted }}>
            Your data is encrypted and private — only you can see it
          </span>
        </div>
      </div>

      {/* Add Record Modal */}
      {showAddRecord && (
        <AddRecordModal onClose={() => setShowAddRecord(false)} onUpload={handleUpload} />
      )}

      <style>{`
        @keyframes libraryFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default BioVaultView;
