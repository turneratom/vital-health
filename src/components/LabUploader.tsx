import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
  type ParsedBiomarker,
  type BiomarkerCategory,
  parseAIResponse,
  buildVaultMapping,
  extractBiomarkersFromText,
  BIOMARKER_EXTRACTION_PROMPT,
} from '../lib/LabResultParser';
import { getTwinSessionId } from '../lib/twinSession';
import { QuickSync } from './QuickSync';

/* ═══════════════════════════════════════════════════════════════
   LAB UPLOADER — Secure Biomarker Ingestion Terminal
   
   Full flow: Upload → Scanning animation → Verification table → Commit
   Users can edit extracted values before committing to BioVault.
   
   NEW: Image upload zone for blood test photos (JPG/PNG/HEIC)
   with processing state indicator and Convex file storage.
   ═══════════════════════════════════════════════════════════════ */

type UploadPhase = 'idle' | 'scanning' | 'verify' | 'committing' | 'complete' | 'error';
type ImageUploadPhase = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

interface EditableAnalyte {
  id: string;
  name: string;
  value: number;
  originalValue: number;
  unit: string;
  status: 'optimal' | 'warning' | 'critical';
  category: BiomarkerCategory;
  vaultKey: string | null;
  isEditing: boolean;
  isModified: boolean;
  isIncluded: boolean;
}

interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  storageId?: string;
  phase: ImageUploadPhase;
  progress: number;
  processingStep: string;
  error?: string;
}

/* ── Simulated analyte extraction (fallback when no AI available) ── */
const SIMULATED_ANALYTES: EditableAnalyte[] = [
  { id: 'a1', name: 'Vitamin D (25-OH)', value: 38, originalValue: 38, unit: 'ng/mL', status: 'warning', category: 'vitamins', vaultKey: 'vitaminD', isEditing: false, isModified: false, isIncluded: true },
  { id: 'a2', name: 'Ferritin', value: 72, originalValue: 72, unit: 'ng/mL', status: 'optimal', category: 'minerals', vaultKey: 'ferritin', isEditing: false, isModified: false, isIncluded: true },
  { id: 'a3', name: 'hs-CRP', value: 1.2, originalValue: 1.2, unit: 'mg/L', status: 'warning', category: 'inflammation', vaultKey: 'crp', isEditing: false, isModified: false, isIncluded: true },
  { id: 'a4', name: 'HbA1c', value: 5.3, originalValue: 5.3, unit: '%', status: 'optimal', category: 'metabolic', vaultKey: 'hba1c', isEditing: false, isModified: false, isIncluded: true },
  { id: 'a5', name: 'Testosterone (Total)', value: 620, originalValue: 620, unit: 'ng/dL', status: 'optimal', category: 'hormones', vaultKey: 'testosteroneTotal', isEditing: false, isModified: false, isIncluded: true },
  { id: 'a6', name: 'Testosterone (Free)', value: 15.2, originalValue: 15.2, unit: 'pg/mL', status: 'optimal', category: 'hormones', vaultKey: 'testosteroneFree', isEditing: false, isModified: false, isIncluded: true },
  { id: 'a7', name: 'TSH', value: 2.1, originalValue: 2.1, unit: 'mIU/L', status: 'optimal', category: 'thyroid', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a8', name: 'Free T4', value: 1.3, originalValue: 1.3, unit: 'ng/dL', status: 'optimal', category: 'thyroid', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a9', name: 'Cortisol (AM)', value: 18.5, originalValue: 18.5, unit: 'mcg/dL', status: 'warning', category: 'hormones', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a10', name: 'DHEA-S', value: 340, originalValue: 340, unit: 'mcg/dL', status: 'optimal', category: 'hormones', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a11', name: 'Homocysteine', value: 8.2, originalValue: 8.2, unit: 'umol/L', status: 'optimal', category: 'cardiac', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a12', name: 'Magnesium (RBC)', value: 5.1, originalValue: 5.1, unit: 'mg/dL', status: 'optimal', category: 'minerals', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a13', name: 'Zinc', value: 85, originalValue: 85, unit: 'mcg/dL', status: 'optimal', category: 'minerals', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a14', name: 'B12', value: 680, originalValue: 680, unit: 'pg/mL', status: 'optimal', category: 'vitamins', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a15', name: 'Folate', value: 14.2, originalValue: 14.2, unit: 'ng/mL', status: 'optimal', category: 'vitamins', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a16', name: 'Iron (Serum)', value: 95, originalValue: 95, unit: 'mcg/dL', status: 'optimal', category: 'minerals', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a17', name: 'GGT', value: 22, originalValue: 22, unit: 'U/L', status: 'optimal', category: 'liver', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a18', name: 'ALT', value: 28, originalValue: 28, unit: 'U/L', status: 'optimal', category: 'liver', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a19', name: 'AST', value: 24, originalValue: 24, unit: 'U/L', status: 'optimal', category: 'liver', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a20', name: 'Creatinine', value: 1.0, originalValue: 1.0, unit: 'mg/dL', status: 'optimal', category: 'kidney', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a21', name: 'eGFR', value: 98, originalValue: 98, unit: 'mL/min', status: 'optimal', category: 'kidney', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a22', name: 'LDL-C', value: 105, originalValue: 105, unit: 'mg/dL', status: 'warning', category: 'lipids', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a23', name: 'HDL-C', value: 58, originalValue: 58, unit: 'mg/dL', status: 'optimal', category: 'lipids', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a24', name: 'Triglycerides', value: 88, originalValue: 88, unit: 'mg/dL', status: 'optimal', category: 'lipids', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a25', name: 'ApoB', value: 82, originalValue: 82, unit: 'mg/dL', status: 'optimal', category: 'lipids', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a26', name: 'Lp(a)', value: 12, originalValue: 12, unit: 'nmol/L', status: 'optimal', category: 'lipids', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a27', name: 'Insulin (Fasting)', value: 5.2, originalValue: 5.2, unit: 'uIU/mL', status: 'optimal', category: 'metabolic', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a28', name: 'Glucose (Fasting)', value: 88, originalValue: 88, unit: 'mg/dL', status: 'optimal', category: 'metabolic', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a29', name: 'WBC', value: 5.8, originalValue: 5.8, unit: 'K/uL', status: 'optimal', category: 'hematology', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a30', name: 'Hemoglobin', value: 15.2, originalValue: 15.2, unit: 'g/dL', status: 'optimal', category: 'hematology', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a31', name: 'Hematocrit', value: 44.5, originalValue: 44.5, unit: '%', status: 'optimal', category: 'hematology', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a32', name: 'Platelets', value: 245, originalValue: 245, unit: 'K/uL', status: 'optimal', category: 'hematology', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a33', name: 'Omega-3 Index', value: 7.2, originalValue: 7.2, unit: '%', status: 'warning', category: 'lipids', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
  { id: 'a34', name: 'IGF-1', value: 185, originalValue: 185, unit: 'ng/mL', status: 'optimal', category: 'hormones', vaultKey: null, isEditing: false, isModified: false, isIncluded: true },
];

const SCAN_PHASES = [
  { label: 'AUTHENTICATING DOCUMENT', duration: 800 },
  { label: 'EXTRACTING BIOMARKERS', duration: 1200 },
  { label: 'CROSS-REFERENCING RANGES', duration: 1000 },
  { label: 'MAPPING TO BIO-VAULT', duration: 800 },
  { label: 'GENERATING PROTOCOL DELTAS', duration: 600 },
];

/* ── Image processing simulation phases ── */
const IMAGE_PROCESS_PHASES = [
  { label: 'VALIDATING IMAGE QUALITY', duration: 600, icon: '🔍' },
  { label: 'DETECTING TABLE REGIONS', duration: 900, icon: '📐' },
  { label: 'OCR TEXT EXTRACTION', duration: 1400, icon: '🔤' },
  { label: 'PARSING BIOMARKER VALUES', duration: 1100, icon: '🧬' },
  { label: 'CROSS-REFERENCING RANGES', duration: 800, icon: '📊' },
  { label: 'ENCRYPTING & STORING', duration: 500, icon: '🔒' },
];

const CATEGORY_LABELS: Record<string, string> = {
  hormones: 'Hormones',
  metabolic: 'Metabolic',
  lipids: 'Lipids',
  vitamins: 'Vitamins',
  minerals: 'Minerals',
  inflammation: 'Inflammation',
  liver: 'Liver',
  kidney: 'Kidney',
  thyroid: 'Thyroid',
  hematology: 'Hematology',
  cardiac: 'Cardiac',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  hormones: '#A855F7',
  metabolic: '#F59E0B',
  lipids: '#EF4444',
  vitamins: '#10B981',
  minerals: '#06B6D4',
  inflammation: '#F97316',
  liver: '#84CC16',
  kidney: '#8B5CF6',
  thyroid: '#EC4899',
  hematology: '#3B82F6',
  cardiac: '#EF4444',
  other: '#6B7280',
};

function statusColor(s: string) {
  if (s === 'optimal') return '#34D399';
  if (s === 'warning') return '#FFD60A';
  return '#FF453A';
}

function statusLabel(s: string) {
  if (s === 'optimal') return 'OK';
  if (s === 'warning') return 'FLAG';
  return 'CRIT';
}

/* ── Accepted image MIME types ── */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
const isImageFile = (file: File) => IMAGE_TYPES.includes(file.type) || /\.(jpg|jpeg|png|heic|heif|webp)$/i.test(file.name);
const isDocFile = (file: File) => !isImageFile(file);

/* ── Format file size ── */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ═══════════════════════════════════════════════════════════════
   OCR SCAN LINE — Animated scan line overlay on image preview
   ═══════════════════════════════════════════════════════════════ */
function OcrScanOverlay({ phase }: { phase: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
      {/* Scanning laser line */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] z-20"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,242,255,0.3) 20%, rgba(0,242,255,0.9) 50%, rgba(0,242,255,0.3) 80%, transparent 100%)',
          boxShadow: '0 0 12px rgba(0,242,255,0.6), 0 0 30px rgba(0,242,255,0.2)',
        }}
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
      {/* Grid overlay for OCR detection feel */}
      {phase >= 1 && (
        <motion.div
          className="absolute inset-0 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.15, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,242,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,242,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        />
      )}
      {/* Corner detection brackets */}
      {phase >= 1 && (
        <>
          {[
            { top: 4, left: 4, borderTop: true, borderLeft: true },
            { top: 4, right: 4, borderTop: true, borderRight: true },
            { bottom: 4, left: 4, borderBottom: true, borderLeft: true },
            { bottom: 4, right: 4, borderBottom: true, borderRight: true },
          ].map((pos, i) => (
            <motion.div
              key={i}
              className="absolute w-5 h-5 z-20"
              style={{
                ...(pos.top !== undefined ? { top: pos.top } : {}),
                ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
                ...(pos.left !== undefined ? { left: pos.left } : {}),
                ...(pos.right !== undefined ? { right: pos.right } : {}),
                borderTop: pos.borderTop ? '2px solid rgba(0,242,255,0.7)' : 'none',
                borderBottom: pos.borderBottom ? '2px solid rgba(0,242,255,0.7)' : 'none',
                borderLeft: pos.borderLeft ? '2px solid rgba(0,242,255,0.7)' : 'none',
                borderRight: pos.borderRight ? '2px solid rgba(0,242,255,0.7)' : 'none',
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
            />
          ))}
        </>
      )}
      {/* Highlight boxes simulating detected text regions */}
      {phase >= 2 && (
        <>
          {[
            { top: '15%', left: '10%', width: '60%', height: '6%' },
            { top: '28%', left: '10%', width: '75%', height: '6%' },
            { top: '41%', left: '10%', width: '55%', height: '6%' },
            { top: '54%', left: '10%', width: '70%', height: '6%' },
            { top: '67%', left: '10%', width: '50%', height: '6%' },
            { top: '80%', left: '10%', width: '65%', height: '6%' },
          ].map((rect, i) => (
            <motion.div
              key={`rect-${i}`}
              className="absolute z-15 rounded-sm"
              style={{
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                background: 'rgba(0,242,255,0.06)',
                border: '1px solid rgba(0,242,255,0.2)',
              }}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: [0, 0.8, 0.4], scaleX: 1 }}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
            />
          ))}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IMAGE UPLOAD CARD — Individual image with processing state
   ═══════════════════════════════════════════════════════════════ */
function ImageUploadCard({
  image,
  onRemove,
}: {
  image: UploadedImage;
  onRemove: (id: string) => void;
}) {
  const isProcessing = image.phase === 'processing' || image.phase === 'uploading';
  const isDone = image.phase === 'complete';
  const isError = image.phase === 'error';

  /* Determine current processing step index */
  const stepIndex = useMemo(() => {
    const idx = IMAGE_PROCESS_PHASES.findIndex(p => p.label === image.processingStep);
    return idx >= 0 ? idx : 0;
  }, [image.processingStep]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, y: -4 }}
      transition={{ duration: 0.25 }}
      className="relative rounded-xl overflow-hidden"
      style={{
        background: 'rgba(12,12,14,0.72)',
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        border: isDone
          ? '1px solid rgba(52,211,153,0.25)'
          : isError
            ? '1px solid rgba(255,69,58,0.25)'
            : isProcessing
              ? '1px solid rgba(0,242,255,0.2)'
              : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isDone
          ? '0 0 20px rgba(52,211,153,0.06), inset 0 1px 0 rgba(255,255,255,0.04)'
          : isProcessing
            ? '0 0 20px rgba(0,242,255,0.06), inset 0 1px 0 rgba(255,255,255,0.04)'
            : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div className="flex gap-3 p-3">
        {/* Image thumbnail with scan overlay */}
        <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0" style={{
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <img
            src={image.previewUrl}
            alt={image.file.name}
            className="w-full h-full object-cover"
            style={{
              filter: isProcessing ? 'brightness(0.7) contrast(1.1)' : 'none',
              transition: 'filter 0.3s ease',
            }}
          />
          {isProcessing && <OcrScanOverlay phase={stepIndex} />}
          {isDone && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center z-20"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(52,211,153,0.2)',
                  border: '2px solid rgba(52,211,153,0.6)',
                  boxShadow: '0 0 16px rgba(52,211,153,0.3)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </motion.div>
            </motion.div>
          )}
          {isError && (
            <div className="absolute inset-0 flex items-center justify-center z-20" style={{ background: 'rgba(0,0,0,0.5)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{
                background: 'rgba(255,69,58,0.15)',
                border: '2px solid rgba(255,69,58,0.5)',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF453A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Info + processing steps */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {image.file.name}
              </span>
              <button
                onClick={() => onRemove(image.id)}
                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors hover:bg-white/[0.06]"
                title="Remove"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {formatFileSize(image.file.size)} &middot; {image.file.type.split('/')[1]?.toUpperCase() || 'IMAGE'}
            </span>
          </div>

          {/* Processing steps */}
          {isProcessing && (
            <div className="mt-1.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <motion.div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: 'rgba(0,242,255,0.8)',
                    boxShadow: '0 0 6px rgba(0,242,255,0.5)',
                  }}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(0,242,255,0.8)' }}>
                  {image.processingStep}
                </span>
              </div>
              {/* Mini progress bar */}
              <div className="h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, rgba(0,242,255,0.6), rgba(168,85,247,0.6))',
                    boxShadow: '0 0 6px rgba(0,242,255,0.3)',
                  }}
                  animate={{ width: `${image.progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              {/* Step indicators */}
              <div className="flex gap-0.5 mt-1.5">
                {IMAGE_PROCESS_PHASES.map((p, i) => (
                  <div
                    key={i}
                    className="flex-1 h-[3px] rounded-full transition-all duration-300"
                    style={{
                      background: i < stepIndex
                        ? 'rgba(52,211,153,0.5)'
                        : i === stepIndex
                          ? 'rgba(0,242,255,0.5)'
                          : 'rgba(255,255,255,0.04)',
                      boxShadow: i === stepIndex ? '0 0 4px rgba(0,242,255,0.3)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Complete state */}
          {isDone && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{
                background: '#34D399',
                boxShadow: '0 0 4px rgba(52,211,153,0.5)',
              }} />
              <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(52,211,153,0.7)' }}>
                STORED &middot; READY FOR EXTRACTION
              </span>
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[8px] font-mono" style={{ color: 'rgba(255,69,58,0.7)' }}>
                {image.error || 'Upload failed. Please retry.'}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN LAB UPLOADER COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function LabUploader({ compact = false }: { compact?: boolean }) {
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [isDragOver, setIsDragOver] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentScanPhase, setCurrentScanPhase] = useState(0);
  const [analytesDetected, setAnalytesDetected] = useState(0);
  const [fileName, setFileName] = useState('');
  const [analytes, setAnalytes] = useState<EditableAnalyte[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [commitProgress, setCommitProgress] = useState(0);
  const [uploadMode, setUploadMode] = useState<'document' | 'image' | 'paste'>('paste');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isImageDragOver, setIsImageDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyScrollRef = useRef<HTMLDivElement>(null);

  const sessionId = typeof window !== 'undefined' ? getTwinSessionId() : '';
  const commitLabResults = useMutation(api.logs.commitLabResults);
  const upsertBioVault = useMutation(api.mutations.upsertBioVault);
  const generateUploadUrl = useMutation(api.vaultFiles.generateUploadUrl);
  const createVaultFile = useMutation(api.vaultFiles.createVaultFile);

  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      // Revoke object URLs on unmount
      uploadedImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  /* ── Convert ParsedBiomarker[] to EditableAnalyte[] ── */
  const toEditable = useCallback((parsed: ParsedBiomarker[]): EditableAnalyte[] => {
    return parsed.map((bm, i) => ({
      id: `parsed-${i}`,
      name: bm.name,
      value: bm.value,
      originalValue: bm.value,
      unit: bm.unit,
      status: bm.status,
      category: bm.category,
      vaultKey: bm.vaultKey,
      isEditing: false,
      isModified: false,
      isIncluded: true,
    }));
  }, []);

  /* ── Simulate scanning process ── */
  const startScan = useCallback((file: File) => {
    setFileName(file.name);
    setPhase('scanning');
    setScanProgress(0);
    setCurrentScanPhase(0);
    setAnalytesDetected(0);
    setAnalytes([]);
    setActiveCategory(null);
    setEditingId(null);

    const reader = new FileReader();
    let extractedAnalytes: EditableAnalyte[] | null = null;

    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const parsed = extractBiomarkersFromText(text);
        if (parsed.length > 0) {
          extractedAnalytes = toEditable(parsed);
        }
      }
    };

    if (file.name.match(/\.(csv|txt|json)$/i)) {
      reader.readAsText(file);
    }

    const totalDuration = SCAN_PHASES.reduce((s, p) => s + p.duration, 0);
    let elapsed = 0;
    let phaseIdx = 0;
    let phaseElapsed = 0;

    scanIntervalRef.current = setInterval(() => {
      elapsed += 50;
      phaseElapsed += 50;

      if (phaseIdx < SCAN_PHASES.length && phaseElapsed >= SCAN_PHASES[phaseIdx].duration) {
        phaseIdx++;
        phaseElapsed = 0;
        setCurrentScanPhase(phaseIdx);
      }

      const pct = Math.min(100, (elapsed / totalDuration) * 100);
      setScanProgress(pct);
      setAnalytesDetected(Math.floor((pct / 100) * (extractedAnalytes?.length || SIMULATED_ANALYTES.length)));

      if (elapsed >= totalDuration) {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        setScanProgress(100);
        const finalAnalytes = extractedAnalytes || [...SIMULATED_ANALYTES];
        setAnalytesDetected(finalAnalytes.length);
        setAnalytes(finalAnalytes);
        setTimeout(() => setPhase('verify'), 600);
      }
    }, 50);
  }, [toEditable]);

  /* ═══════════════════════════════════════════════════════════
     IMAGE UPLOAD — Upload to Convex storage + processing sim
     ═══════════════════════════════════════════════════════════ */
  const processImageUpload = useCallback(async (file: File) => {
    const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const previewUrl = URL.createObjectURL(file);

    const newImage: UploadedImage = {
      id,
      file,
      previewUrl,
      phase: 'uploading',
      progress: 0,
      processingStep: IMAGE_PROCESS_PHASES[0].label,
    };

    setUploadedImages(prev => [...prev, newImage]);

    const updateImage = (updates: Partial<UploadedImage>) => {
      setUploadedImages(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));
    };

    try {
      // Step 1: Upload to Convex storage
      updateImage({ phase: 'uploading', progress: 5, processingStep: IMAGE_PROCESS_PHASES[0].label });

      const uploadUrl = await generateUploadUrl();
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResponse.ok) throw new Error('Upload failed');
      const { storageId } = await uploadResponse.json();

      updateImage({ storageId, progress: 15 });

      // Step 2: Create vault file record
      if (sessionId) {
        await createVaultFile({
          sessionId,
          fileName: file.name,
          fileType: file.type.split('/')[1] || 'image',
          category: 'lab-results-image',
          fileSize: file.size,
          storageId,
          notes: 'Blood test image — pending AI extraction',
        });
      }

      updateImage({ phase: 'processing', progress: 20 });

      // Step 3: Simulate processing phases (foundation for future AI extraction)
      const totalDuration = IMAGE_PROCESS_PHASES.reduce((s, p) => s + p.duration, 0);
      let elapsed = 0;
      let phaseIdx = 0;
      let phaseElapsed = 0;

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          elapsed += 50;
          phaseElapsed += 50;

          if (phaseIdx < IMAGE_PROCESS_PHASES.length && phaseElapsed >= IMAGE_PROCESS_PHASES[phaseIdx].duration) {
            phaseIdx++;
            phaseElapsed = 0;
          }

          const pct = Math.min(100, 20 + (elapsed / totalDuration) * 80);
          const currentPhase = IMAGE_PROCESS_PHASES[Math.min(phaseIdx, IMAGE_PROCESS_PHASES.length - 1)];

          updateImage({
            progress: Math.round(pct),
            processingStep: currentPhase.label,
          });

          if (elapsed >= totalDuration) {
            clearInterval(interval);
            resolve();
          }
        }, 50);
      });

      updateImage({ phase: 'complete', progress: 100, processingStep: 'COMPLETE' });

    } catch (err) {
      console.error('Image upload error:', err);
      updateImage({
        phase: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      });
    }
  }, [generateUploadUrl, createVaultFile, sessionId]);

  const handleImageFiles = useCallback((files: FileList) => {
    Array.from(files).forEach(file => {
      if (isImageFile(file)) {
        processImageUpload(file);
      }
    });
  }, [processImageUpload]);

  const removeImage = useCallback((id: string) => {
    setUploadedImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  /* ── Drag handlers ── */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      // Route to image or document handler
      const file = files[0];
      if (isImageFile(file)) {
        setUploadMode('image');
        handleImageFiles(files);
      } else {
        setUploadMode('document');
        startScan(file);
      }
    }
  }, [startScan, handleImageFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) startScan(files[0]);
  }, [startScan]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleImageFiles(files);
  }, [handleImageFiles]);

  /* ── Image drag handlers ── */
  const handleImageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsImageDragOver(true);
  }, []);

  const handleImageDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsImageDragOver(false);
  }, []);

  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsImageDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleImageFiles(files);
  }, [handleImageFiles]);

  const handleReset = useCallback(() => {
    setPhase('idle');
    setScanProgress(0);
    setCurrentScanPhase(0);
    setAnalytesDetected(0);
    setFileName('');
    setAnalytes([]);
    setActiveCategory(null);
    setEditingId(null);
    setCommitProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  /* ── Edit handlers ── */
  const startEdit = useCallback((id: string, currentValue: number) => {
    setEditingId(id);
    setEditValue(String(currentValue));
  }, []);

  const confirmEdit = useCallback((id: string) => {
    const numVal = parseFloat(editValue);
    if (!isNaN(numVal) && numVal >= 0) {
      setAnalytes(prev => prev.map(a =>
        a.id === id ? { ...a, value: numVal, isModified: numVal !== a.originalValue } : a
      ));
    }
    setEditingId(null);
    setEditValue('');
  }, [editValue]);

  const toggleInclude = useCallback((id: string) => {
    setAnalytes(prev => prev.map(a =>
      a.id === id ? { ...a, isIncluded: !a.isIncluded } : a
    ));
  }, []);

  const revertValue = useCallback((id: string) => {
    setAnalytes(prev => prev.map(a =>
      a.id === id ? { ...a, value: a.originalValue, isModified: false } : a
    ));
  }, []);

  /* ── Commit verified results ── */
  const handleCommit = useCallback(async () => {
    if (!sessionId) return;
    setPhase('committing');
    setCommitProgress(0);

    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      await new Promise(r => setTimeout(r, 60));
      setCommitProgress(Math.round((i / steps) * 100));
    }

    const included = analytes.filter(a => a.isIncluded);
    const vaultData: Record<string, number> = {};
    for (const a of included) {
      if (a.vaultKey) {
        vaultData[a.vaultKey] = a.value;
      }
    }

    try {
      await commitLabResults({
        sessionId,
        vitaminD: vaultData.vitaminD,
        ferritin: vaultData.ferritin,
        crp: vaultData.crp,
        hba1c: vaultData.hba1c,
        testosteroneTotal: vaultData.testosteroneTotal,
        testosteroneFree: vaultData.testosteroneFree,
      });

      window.dispatchEvent(new CustomEvent('vive:lab-sync', {
        detail: { timestamp: Date.now(), analytes: included.length },
      }));

      setPhase('complete');
    } catch (err) {
      console.error('Failed to commit lab results:', err);
      setPhase('error');
    }
  }, [sessionId, analytes, commitLabResults]);

  /* ── Derived data ── */
  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const a of analytes) {
      cats.set(a.category, (cats.get(a.category) || 0) + 1);
    }
    return Array.from(cats.entries()).sort((a, b) => b[1] - a[1]);
  }, [analytes]);

  const filteredAnalytes = useMemo(() => {
    if (!activeCategory) return analytes;
    return analytes.filter(a => a.category === activeCategory);
  }, [analytes, activeCategory]);

  const flaggedCount = useMemo(() => analytes.filter(a => a.status !== 'optimal').length, [analytes]);
  const modifiedCount = useMemo(() => analytes.filter(a => a.isModified).length, [analytes]);
  const includedCount = useMemo(() => analytes.filter(a => a.isIncluded).length, [analytes]);
  const vaultMappableCount = useMemo(() => analytes.filter(a => a.isIncluded && a.vaultKey).length, [analytes]);

  const imageStats = useMemo(() => ({
    total: uploadedImages.length,
    processing: uploadedImages.filter(i => i.phase === 'processing' || i.phase === 'uploading').length,
    complete: uploadedImages.filter(i => i.phase === 'complete').length,
    error: uploadedImages.filter(i => i.phase === 'error').length,
  }), [uploadedImages]);

  /* ── Compact mode for TopHeader integration ── */
  if (compact) {
    return (
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-200 hover:scale-[1.02]"
        style={{
          background: 'rgba(59,130,246,0.04)',
          border: '1px solid rgba(59,130,246,0.08)',
        }}
        title="Upload Lab Results"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="text-[8px] font-mono tracking-wider hidden sm:inline" style={{ color: 'rgba(59,130,246,0.4)' }}>
          LAB
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv,.xlsx,.xls,.json,.txt,.jpg,.jpeg,.png,.heic,.heif,.webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </button>
    );
  }

  return (
    <div className="mb-4">
      {/* Section Header */}
      <div className="flex items-center gap-2 px-1 mb-3">
        <div className="flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(59,130,246,0.8)' }}>
            Data Ingestion
          </span>
        </div>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.15), transparent)' }} />
        <div className="flex items-center gap-1">
          <div className="w-1 h-1 rounded-full" style={{
            background: phase === 'complete' ? '#34D399' : phase === 'verify' ? '#F59E0B' : imageStats.processing > 0 ? '#00F2FF' : 'rgba(59,130,246,0.4)',
            boxShadow: phase === 'complete' ? '0 0 4px rgba(52,211,153,0.5)' : phase === 'verify' ? '0 0 4px rgba(245,158,11,0.5)' : imageStats.processing > 0 ? '0 0 4px rgba(0,242,255,0.5)' : 'none',
          }} />
          <span className="text-[8px] font-mono uppercase tracking-wider" style={{
            color: phase === 'complete' ? 'rgba(52,211,153,0.7)' : phase === 'verify' ? 'rgba(245,158,11,0.7)' : phase === 'scanning' || phase === 'committing' ? 'rgba(59,130,246,0.6)' : imageStats.processing > 0 ? 'rgba(0,242,255,0.7)' : 'rgba(59,130,246,0.4)',
          }}>
            {phase === 'complete' ? 'COMMITTED' : phase === 'verify' ? 'VERIFY' : phase === 'scanning' ? 'SCANNING' : phase === 'committing' ? 'COMMITTING' : imageStats.processing > 0 ? 'PROCESSING' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* ═══ MODE TOGGLE — Paste / Document / Image ═══ */}
      <div className="flex gap-1 mb-3 px-1">
        {[
          { id: 'paste' as const, label: 'PASTE', icon: (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
          ), desc: 'Lab text → Vault' },
          { id: 'document' as const, label: 'DOCUMENT', icon: (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          ), desc: 'PDF, CSV, XLSX' },
          { id: 'image' as const, label: 'PHOTO', icon: (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          ), desc: 'JPG, PNG, HEIC' },
        ].map(mode => {
          const isActive = uploadMode === mode.id;
          const hasContent = mode.id === 'image' ? uploadedImages.length > 0 : mode.id === 'document' ? phase !== 'idle' : false;
          return (
            <button
              key={mode.id}
              onClick={() => setUploadMode(mode.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all duration-300 relative overflow-hidden"
              style={{
                background: isActive ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.015)',
                border: `1px solid ${isActive ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)'}`,
                color: isActive ? 'rgba(59,130,246,0.9)' : 'rgba(255,255,255,0.3)',
              }}
            >
              {mode.icon}
              <div className="flex flex-col items-start">
                <span className="text-[9px] font-bold tracking-wider">{mode.label}</span>
                <span className="text-[7px] font-mono" style={{ color: isActive ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.15)' }}>
                  {mode.desc}
                </span>
              </div>
              {hasContent && (
                <div className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full" style={{
                  background: mode.id === 'image' && imageStats.processing > 0 ? '#00F2FF' : '#34D399',
                  boxShadow: `0 0 4px ${mode.id === 'image' && imageStats.processing > 0 ? 'rgba(0,242,255,0.5)' : 'rgba(52,211,153,0.5)'}`,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ IMAGE UPLOAD MODE ═══ */}
      <AnimatePresence mode="wait">
        {uploadMode === 'paste' && (
          <motion.div
            key="paste-mode"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <QuickSync />
          </motion.div>
        )}

        {uploadMode === 'image' && (
          <motion.div
            key="image-mode"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {/* Image drop zone */}
            <div
              className="relative rounded-xl overflow-hidden transition-all duration-300 cursor-pointer"
              style={{
                background: isImageDragOver
                  ? 'rgba(0,242,255,0.04)'
                  : 'rgba(0,242,255,0.015)',
                border: isImageDragOver
                  ? '1px dashed rgba(0,242,255,0.5)'
                  : '1px dashed rgba(0,242,255,0.12)',
                boxShadow: isImageDragOver
                  ? '0 0 24px rgba(0,242,255,0.06), inset 0 0 24px rgba(0,242,255,0.03)'
                  : 'none',
              }}
              onDragOver={handleImageDragOver}
              onDragLeave={handleImageDragLeave}
              onDrop={handleImageDrop}
              onClick={() => imageInputRef.current?.click()}
            >
              <div className="flex flex-col items-center justify-center py-5 px-4">
                <div className="relative mb-2.5">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
                    background: 'rgba(0,242,255,0.06)',
                    border: '1px solid rgba(0,242,255,0.15)',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(0,242,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <motion.div
                    className="absolute inset-0 rounded-lg"
                    style={{ border: '1px solid rgba(0,242,255,0.2)' }}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  />
                </div>
                <span className="text-[11px] font-semibold tracking-wide mb-0.5" style={{ color: 'rgba(0,242,255,0.8)' }}>
                  UPLOAD BLOOD TEST PHOTOS
                </span>
                <span className="text-[9px] font-mono text-center leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Drop images here or click to browse
                </span>
                <span className="text-[8px] font-mono mt-0.5" style={{ color: 'rgba(0,242,255,0.3)' }}>
                  JPG &middot; PNG &middot; HEIC &middot; WebP &middot; Multiple files supported
                </span>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{
                    background: 'rgba(0,242,255,0.04)',
                    border: '1px solid rgba(0,242,255,0.08)',
                  }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(0,242,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: 'rgba(0,242,255,0.35)' }}>
                      AES-256 Encrypted
                    </span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{
                    background: 'rgba(168,85,247,0.04)',
                    border: '1px solid rgba(168,85,247,0.08)',
                  }}>
                    <span className="text-[7px]">🧬</span>
                    <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: 'rgba(168,85,247,0.35)' }}>
                      AI Extraction Ready
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Uploaded images list */}
            {uploadedImages.length > 0 && (
              <div className="mt-3 space-y-2">
                {/* Stats bar */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {imageStats.total} image{imageStats.total !== 1 ? 's' : ''}
                    </span>
                    {imageStats.processing > 0 && (
                      <span className="flex items-center gap-1 text-[8px] font-mono" style={{ color: 'rgba(0,242,255,0.7)' }}>
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          ●
                        </motion.span>
                        {imageStats.processing} processing
                      </span>
                    )}
                    {imageStats.complete > 0 && (
                      <span className="text-[8px] font-mono" style={{ color: 'rgba(52,211,153,0.6)' }}>
                        ✓ {imageStats.complete} stored
                      </span>
                    )}
                  </div>
                  {imageStats.complete > 0 && imageStats.processing === 0 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{
                      background: 'rgba(168,85,247,0.06)',
                      border: '1px solid rgba(168,85,247,0.15)',
                    }}>
                      <span className="text-[7px]">🧠</span>
                      <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: 'rgba(168,85,247,0.6)' }}>
                        AWAITING AI EXTRACTION
                      </span>
                    </div>
                  )}
                </div>

                {/* Image cards */}
                <AnimatePresence>
                  {uploadedImages.map(img => (
                    <ImageUploadCard
                      key={img.id}
                      image={img}
                      onRemove={removeImage}
                    />
                  ))}
                </AnimatePresence>

                {/* Extraction CTA (shown when all images are processed) */}
                {imageStats.complete > 0 && imageStats.processing === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                    className="rounded-xl p-3 mt-2"
                    style={{
                      background: 'rgba(12,12,14,0.6)',
                      backdropFilter: 'blur(24px) saturate(1.4)',
                      WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
                      border: '1px solid rgba(168,85,247,0.15)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{
                          background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(0,242,255,0.08))',
                          border: '1px solid rgba(168,85,247,0.2)',
                        }}>
                          <span className="text-[14px]">🧬</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold tracking-wide" style={{ color: 'rgba(168,85,247,0.9)' }}>
                            INTELLIGENT EXTRACTION
                          </span>
                          <span className="text-[8px] font-mono" style={{ color: 'rgba(168,85,247,0.45)' }}>
                            Image AI extract gated — paste lab text instead ({imageStats.complete} stored)
                          </span>
                        </div>
                      </div>
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all duration-300 hover:scale-[1.02]"
                        style={{
                          background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(0,242,255,0.1))',
                          border: '1px solid rgba(168,85,247,0.3)',
                          color: 'rgba(168,85,247,0.9)',
                          boxShadow: '0 0 12px rgba(168,85,247,0.08)',
                          cursor: 'not-allowed',
                          opacity: 0.6,
                        }}
                        title="AI extraction coming soon — use Paste for text labs"
                        disabled
                        type="button"
                        aria-disabled="true"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          <path d="M2 17l10 5 10-5" />
                          <path d="M2 12l10 5 10-5" />
                        </svg>
                        COMING SOON
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* Hidden image input */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
          </motion.div>
        )}

        {/* ═══ DOCUMENT UPLOAD MODE ═══ */}
        {uploadMode === 'document' && (
          <motion.div
            key="document-mode"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {/* Upload Zone */}
            <div
              className="relative rounded-xl overflow-hidden transition-all duration-300"
              style={{
                background: phase === 'complete'
                  ? 'rgba(52,211,153,0.03)'
                  : phase === 'verify'
                    ? 'rgba(245,158,11,0.02)'
                    : isDragOver
                      ? 'rgba(59,130,246,0.06)'
                      : 'rgba(59,130,246,0.02)',
                border: phase === 'complete'
                  ? '1px dashed rgba(52,211,153,0.3)'
                  : phase === 'verify'
                    ? '1px solid rgba(245,158,11,0.15)'
                    : isDragOver
                      ? '1px dashed rgba(59,130,246,0.5)'
                      : '1px dashed rgba(59,130,246,0.15)',
                boxShadow: isDragOver ? '0 0 24px rgba(59,130,246,0.08), inset 0 0 24px rgba(59,130,246,0.04)' : 'none',
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Scanning Laser Animation */}
              {phase === 'scanning' && (
                <motion.div
                  className="absolute left-0 right-0 h-[1px] z-10 pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.8), rgba(59,130,246,1), rgba(59,130,246,0.8), transparent)',
                    boxShadow: '0 0 12px rgba(59,130,246,0.6), 0 0 24px rgba(59,130,246,0.3)',
                  }}
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
              )}

              {/* Committing pulse */}
              {phase === 'committing' && (
                <motion.div
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{ background: 'radial-gradient(ellipse at center, rgba(52,211,153,0.06), transparent 70%)' }}
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              )}

              <AnimatePresence mode="wait">
                {/* ═══ IDLE STATE ═══ */}
                {phase === 'idle' && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center justify-center py-6 px-4 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="relative mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
                        background: 'rgba(59,130,246,0.06)',
                        border: '1px solid rgba(59,130,246,0.12)',
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <motion.div
                        className="absolute inset-0 rounded-lg"
                        style={{ border: '1px solid rgba(59,130,246,0.2)' }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold tracking-wide mb-1" style={{ color: 'rgba(59,130,246,0.8)' }}>
                      SECURE UPLOAD
                    </span>
                    <span className="text-[9px] font-mono text-center leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Drop lab results here or click to browse
                    </span>
                    <span className="text-[8px] font-mono mt-1" style={{ color: 'rgba(59,130,246,0.3)' }}>
                      PDF &middot; CSV &middot; XLSX &middot; JSON
                    </span>
                    <div className="flex items-center gap-1 mt-3 px-2 py-1 rounded-full" style={{
                      background: 'rgba(59,130,246,0.04)',
                      border: '1px solid rgba(59,130,246,0.08)',
                    }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: 'rgba(59,130,246,0.35)' }}>
                        AES-256 Encrypted
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* ═══ SCANNING STATE ═══ */}
                {phase === 'scanning' && (
                  <motion.div
                    key="scanning"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="py-5 px-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded flex items-center justify-center" style={{
                        background: 'rgba(59,130,246,0.1)',
                        border: '1px solid rgba(59,130,246,0.2)',
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[10px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          {fileName}
                        </span>
                        <span className="text-[8px] font-mono" style={{ color: 'rgba(59,130,246,0.5)' }}>
                          SCANNING BIOMARKERS...
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold" style={{
                        color: 'rgba(59,130,246,0.9)',
                        textShadow: '0 0 8px rgba(59,130,246,0.4)',
                      }}>
                        {analytesDetected}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 mb-3">
                      {SCAN_PHASES.map((sp, i) => {
                        const isDone = i < currentScanPhase;
                        const isActive = i === currentScanPhase;
                        return (
                          <div key={i} className="flex items-center gap-2">
                            {isDone ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            ) : isActive ? (
                              <motion.div
                                className="w-2.5 h-2.5 rounded-full border-[1.5px]"
                                style={{ borderColor: 'rgba(59,130,246,0.6)', borderTopColor: 'transparent' }}
                                animate={{ rotate: 360 }}
                                transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                              />
                            ) : (
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
                            )}
                            <span className="text-[9px] font-mono uppercase tracking-wider" style={{
                              color: isDone ? 'rgba(52,211,153,0.7)' : isActive ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.15)',
                            }}>
                              {sp.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
                          boxShadow: '0 0 8px rgba(59,130,246,0.4)',
                        }}
                        animate={{ width: `${scanProgress}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                  </motion.div>
                )}

                {/* ═══ VERIFICATION STATE ═══ */}
                {phase === 'verify' && (
                  <motion.div
                    key="verify"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="py-4 px-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{
                          background: 'rgba(245,158,11,0.08)',
                          border: '1px solid rgba(245,158,11,0.2)',
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 11l3 3L22 4" />
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold tracking-wide" style={{ color: 'rgba(245,158,11,0.9)' }}>
                            VERIFY RESULTS
                          </span>
                          <span className="text-[8px] font-mono" style={{ color: 'rgba(245,158,11,0.5)' }}>
                            {analytes.length} ANALYTES &middot; {flaggedCount} FLAGGED{modifiedCount > 0 ? ` \u00B7 ${modifiedCount} EDITED` : ''}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleReset}
                        className="text-[8px] font-mono uppercase tracking-wider px-2 py-1 rounded transition-all duration-200 hover:bg-white/[0.04]"
                        style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        RESCAN
                      </button>
                    </div>

                    <div className="flex gap-1 mb-3 overflow-x-auto pb-1 scrollbar-none">
                      <button
                        onClick={() => setActiveCategory(null)}
                        className="text-[8px] font-mono uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap transition-all duration-200"
                        style={{
                          background: !activeCategory ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${!activeCategory ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
                          color: !activeCategory ? 'rgba(59,130,246,0.9)' : 'rgba(255,255,255,0.3)',
                        }}
                      >
                        ALL ({analytes.length})
                      </button>
                      {categories.map(([cat, count]) => (
                        <button
                          key={cat}
                          onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                          className="text-[8px] font-mono uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap transition-all duration-200"
                          style={{
                            background: activeCategory === cat ? `${CATEGORY_COLORS[cat]}15` : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${activeCategory === cat ? `${CATEGORY_COLORS[cat]}40` : 'rgba(255,255,255,0.06)'}`,
                            color: activeCategory === cat ? CATEGORY_COLORS[cat] : 'rgba(255,255,255,0.3)',
                          }}
                        >
                          {CATEGORY_LABELS[cat] || cat} ({count})
                        </button>
                      ))}
                    </div>

                    <div
                      ref={verifyScrollRef}
                      className="max-h-[280px] overflow-y-auto rounded-lg scrollbar-none"
                      style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <div className="flex items-center gap-1 px-3 py-2 sticky top-0 z-10" style={{
                        background: 'rgba(10,10,15,0.95)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        backdropFilter: 'blur(8px)',
                      }}>
                        <span className="w-5 text-center text-[7px] font-mono uppercase" style={{ color: 'rgba(255,255,255,0.15)' }}>&#10003;</span>
                        <span className="flex-1 text-[7px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>ANALYTE</span>
                        <span className="w-20 text-right text-[7px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>VALUE</span>
                        <span className="w-10 text-center text-[7px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>STATUS</span>
                        <span className="w-6" />
                      </div>

                      {filteredAnalytes.map((a, i) => (
                        <motion.div
                          key={a.id}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: a.isIncluded ? 1 : 0.4, x: 0 }}
                          transition={{ delay: i * 0.012, duration: 0.15 }}
                          className="flex items-center gap-1 px-3 py-1.5 transition-colors hover:bg-white/[0.02] group"
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.02)',
                            background: a.isModified ? 'rgba(59,130,246,0.03)' : 'transparent',
                          }}
                        >
                          <button
                            onClick={() => toggleInclude(a.id)}
                            className="w-5 h-5 flex items-center justify-center flex-shrink-0 rounded transition-all duration-200"
                            style={{
                              background: a.isIncluded ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${a.isIncluded ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.06)'}`,
                            }}
                          >
                            {a.isIncluded && (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            )}
                          </button>

                          <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <span className="text-[9px] font-mono truncate" style={{ color: a.isIncluded ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)' }}>
                              {a.name}
                            </span>
                            {a.vaultKey && (
                              <span className="text-[6px] font-mono px-1 py-0.5 rounded flex-shrink-0" style={{
                                background: 'rgba(168,85,247,0.08)',
                                color: 'rgba(168,85,247,0.5)',
                                border: '1px solid rgba(168,85,247,0.12)',
                              }}>
                                VAULT
                              </span>
                            )}
                          </div>

                          <div className="w-20 flex items-center justify-end gap-1">
                            {editingId === a.id ? (
                              <div className="flex items-center gap-0.5">
                                <input
                                  type="number"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmEdit(a.id);
                                    if (e.key === 'Escape') { setEditingId(null); setEditValue(''); }
                                  }}
                                  autoFocus
                                  className="w-14 text-[9px] font-mono text-right px-1 py-0.5 rounded outline-none"
                                  style={{
                                    background: 'rgba(59,130,246,0.1)',
                                    border: '1px solid rgba(59,130,246,0.3)',
                                    color: 'rgba(59,130,246,0.9)',
                                  }}
                                />
                                <button
                                  onClick={() => confirmEdit(a.id)}
                                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/[0.05]"
                                >
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 6L9 17l-5-5" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEdit(a.id, a.value)}
                                className="text-[9px] font-mono font-semibold text-right cursor-pointer hover:underline transition-colors"
                                style={{
                                  color: a.isModified ? 'rgba(59,130,246,0.9)' : statusColor(a.status) + 'CC',
                                }}
                                title="Click to edit value"
                              >
                                {a.value}{' '}
                                <span className="text-[7px] font-normal" style={{ color: 'rgba(255,255,255,0.2)' }}>{a.unit}</span>
                              </button>
                            )}
                          </div>

                          <span className="w-10 text-center">
                            <span className="text-[7px] font-mono uppercase px-1 py-0.5 rounded" style={{
                              background: `${statusColor(a.status)}12`,
                              color: `${statusColor(a.status)}99`,
                            }}>
                              {statusLabel(a.status)}
                            </span>
                          </span>

                          <div className="w-6 flex items-center justify-center">
                            {a.isModified ? (
                              <button
                                onClick={() => revertValue(a.id)}
                                className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/[0.05] transition-colors"
                                title="Revert to original"
                              >
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                              </button>
                            ) : (
                              <span className="w-4" />
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {includedCount} included &middot; {vaultMappableCount} mapped to BioVault
                        </span>
                        {modifiedCount > 0 && (
                          <span className="text-[8px] font-mono" style={{ color: 'rgba(59,130,246,0.5)' }}>
                            {modifiedCount} value{modifiedCount !== 1 ? 's' : ''} manually adjusted
                          </span>
                        )}
                      </div>
                      <button
                        onClick={handleCommit}
                        disabled={includedCount === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{
                          background: 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(59,130,246,0.15))',
                          border: '1px solid rgba(52,211,153,0.3)',
                          color: 'rgba(52,211,153,0.9)',
                          boxShadow: '0 0 16px rgba(52,211,153,0.1)',
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        COMMIT TO VAULT
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ═══ COMMITTING STATE ═══ */}
                {phase === 'committing' && (
                  <motion.div
                    key="committing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="py-6 px-4 flex flex-col items-center"
                  >
                    <motion.div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                      style={{
                        background: 'rgba(52,211,153,0.08)',
                        border: '1px solid rgba(52,211,153,0.2)',
                        boxShadow: '0 0 24px rgba(52,211,153,0.1)',
                      }}
                      animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </motion.div>

                    <span className="text-[11px] font-bold tracking-wide mb-1" style={{ color: 'rgba(52,211,153,0.9)' }}>
                      COMMITTING TO BIO-VAULT
                    </span>
                    <span className="text-[9px] font-mono mb-3" style={{ color: 'rgba(52,211,153,0.5)' }}>
                      Encrypting and storing {includedCount} verified analytes...
                    </span>

                    <div className="w-full max-w-[200px] h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, #34D399, #3B82F6)',
                          boxShadow: '0 0 8px rgba(52,211,153,0.4)',
                          width: `${commitProgress}%`,
                        }}
                      />
                    </div>
                    <span className="text-[8px] font-mono mt-2" style={{ color: 'rgba(52,211,153,0.4)' }}>
                      {commitProgress}%
                    </span>
                  </motion.div>
                )}

                {/* ═══ COMPLETE STATE ═══ */}
                {phase === 'complete' && (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="py-5 px-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{
                            background: 'rgba(52,211,153,0.1)',
                            border: '1px solid rgba(52,211,153,0.25)',
                            boxShadow: '0 0 12px rgba(52,211,153,0.15)',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </motion.div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold tracking-wide" style={{ color: 'rgba(52,211,153,0.9)' }}>
                            VERIFIED &amp; COMMITTED
                          </span>
                          <span className="text-[9px] font-mono" style={{ color: 'rgba(52,211,153,0.5)' }}>
                            {includedCount} ANALYTES &middot; {vaultMappableCount} VAULT KEYS UPDATED
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleReset}
                        className="text-[8px] font-mono uppercase tracking-wider px-2 py-1 rounded transition-all duration-200 hover:bg-white/[0.04]"
                        style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        NEW SCAN
                      </button>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2" style={{
                      background: 'rgba(52,211,153,0.04)',
                      border: '1px solid rgba(52,211,153,0.1)',
                    }}>
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: '#34D399', boxShadow: '0 0 6px rgba(52,211,153,0.5)' }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <span className="text-[9px] font-mono" style={{ color: 'rgba(52,211,153,0.6)' }}>
                        BIO-VAULT UPDATED &middot; PROTOCOLS RECALCULATING
                      </span>
                    </div>

                    {modifiedCount > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {analytes.filter(a => a.isModified && a.isIncluded).map(a => (
                          <span key={a.id} className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                            background: 'rgba(59,130,246,0.08)',
                            color: 'rgba(59,130,246,0.7)',
                            border: '1px solid rgba(59,130,246,0.15)',
                          }}>
                            {a.name}: {a.originalValue} &rarr; {a.value} {a.unit}
                          </span>
                        ))}
                      </div>
                    )}

                    {flaggedCount > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {analytes.filter(a => a.status !== 'optimal' && a.isIncluded).map(a => (
                          <span key={a.id} className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                            background: a.status === 'critical' ? 'rgba(255,69,58,0.08)' : 'rgba(255,214,10,0.08)',
                            color: a.status === 'critical' ? 'rgba(255,69,58,0.7)' : 'rgba(255,214,10,0.7)',
                            border: `1px solid ${a.status === 'critical' ? 'rgba(255,69,58,0.15)' : 'rgba(255,214,10,0.15)'}`,
                          }}>
                            {a.name}: {a.value} {a.unit}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ═══ ERROR STATE ═══ */}
                {phase === 'error' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-5 px-4 flex flex-col items-center"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2" style={{
                      background: 'rgba(255,69,58,0.08)',
                      border: '1px solid rgba(255,69,58,0.2)',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF453A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold tracking-wide mb-1" style={{ color: 'rgba(255,69,58,0.9)' }}>
                      COMMIT FAILED
                    </span>
                    <span className="text-[9px] font-mono mb-3 text-center" style={{ color: 'rgba(255,69,58,0.5)' }}>
                      Unable to write to Bio-Vault. Please retry.
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPhase('verify')}
                        className="text-[9px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all duration-200 hover:bg-white/[0.04]"
                        style={{ color: 'rgba(59,130,246,0.7)', border: '1px solid rgba(59,130,246,0.2)' }}
                      >
                        BACK TO VERIFY
                      </button>
                      <button
                        onClick={handleCommit}
                        className="text-[9px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all duration-200"
                        style={{
                          background: 'rgba(52,211,153,0.1)',
                          color: 'rgba(52,211,153,0.8)',
                          border: '1px solid rgba(52,211,153,0.2)',
                        }}
                      >
                        RETRY
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv,.xlsx,.xls,.json,.txt"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LabUploader;
