import {
  ImageGalleryModal,
  AudioPlayerModal,
  VideoPlayerModal,
  TextEditorModal,
  PdfViewerModal,
  DiskAnalyzerModal,
  ShareModal,
  SambaModal,
  FileOperationsModal,
} from './';
import type { FileItem } from '../../types/fileManager';
import type { OperationType } from './FileOperationsModal';

interface FileModalsContainerProps {
  activeImageFile: FileItem | null;
  setActiveImageFile: (file: FileItem | null) => void;
  files: FileItem[];
  activeAudioFile: FileItem | null;
  setActiveAudioFile: (file: FileItem | null) => void;
  activeVideoFile: FileItem | null;
  setActiveVideoFile: (file: FileItem | null) => void;
  activeTextFile: FileItem | null;
  setActiveTextFile: (file: FileItem | null) => void;
  activePdfFile: FileItem | null;
  setActivePdfFile: (file: FileItem | null) => void;
  isDiskAnalyzerOpen: boolean;
  setIsDiskAnalyzerOpen: (open: boolean) => void;
  shareFile: FileItem | null;
  setShareFile: (file: FileItem | null) => void;
  sambaModalOpen: boolean;
  setSambaModalOpen: (open: boolean) => void;
  sambaTargetFolder: FileItem | null;
  setSambaTargetFolder: (folder: FileItem | null) => void;
  opModalType: OperationType | null;
  setOpModalType: (type: OperationType | null) => void;
  opTargetItem: FileItem | null;
  setOpTargetItem: (item: FileItem | null) => void;
  selectedItems: FileItem[];
  currentPath: string;
  loadFiles: (path: string) => void;
  navigateTo: (path: string) => void;
}

export function FileModalsContainer({
  activeImageFile,
  setActiveImageFile,
  files,
  activeAudioFile,
  setActiveAudioFile,
  activeVideoFile,
  setActiveVideoFile,
  activeTextFile,
  setActiveTextFile,
  activePdfFile,
  setActivePdfFile,
  isDiskAnalyzerOpen,
  setIsDiskAnalyzerOpen,
  shareFile,
  setShareFile,
  sambaModalOpen,
  setSambaModalOpen,
  sambaTargetFolder,
  setSambaTargetFolder,
  opModalType,
  setOpModalType,
  opTargetItem,
  setOpTargetItem,
  selectedItems,
  currentPath,
  loadFiles,
  navigateTo,
}: FileModalsContainerProps) {
  return (
    <>
      {activeImageFile && (
        <ImageGalleryModal
          currentFile={activeImageFile}
          files={files}
          isOpen={activeImageFile !== null}
          onClose={() => setActiveImageFile(null)}
        />
      )}

      {activeAudioFile && (
        <AudioPlayerModal
          file={activeAudioFile}
          onClose={() => setActiveAudioFile(null)}
        />
      )}

      {activeVideoFile && (
        <VideoPlayerModal
          file={activeVideoFile}
          onClose={() => setActiveVideoFile(null)}
        />
      )}

      {activeTextFile && (
        <TextEditorModal
          file={activeTextFile}
          onClose={() => setActiveTextFile(null)}
          onSaved={() => loadFiles(currentPath)}
        />
      )}

      {activePdfFile && (
        <PdfViewerModal
          file={activePdfFile}
          onClose={() => setActivePdfFile(null)}
        />
      )}

      {isDiskAnalyzerOpen && (
        <DiskAnalyzerModal
          currentPath={currentPath}
          isOpen={isDiskAnalyzerOpen}
          onClose={() => setIsDiskAnalyzerOpen(false)}
          onNavigateTo={(target) => navigateTo(target)}
        />
      )}

      {shareFile && (
        <ShareModal
          file={shareFile}
          isOpen={shareFile !== null}
          onClose={() => setShareFile(null)}
        />
      )}

      {sambaModalOpen && (
        <SambaModal
          folder={sambaTargetFolder}
          isOpen={sambaModalOpen}
          onClose={() => {
            setSambaModalOpen(false);
            setSambaTargetFolder(null);
          }}
        />
      )}

      <FileOperationsModal
        isOpen={opModalType !== null}
        type={opModalType}
        currentPath={currentPath}
        targetItem={opTargetItem}
        selectedItems={selectedItems}
        onClose={() => {
          setOpModalType(null);
          setOpTargetItem(null);
        }}
        onSuccess={() => loadFiles(currentPath)}
      />
    </>
  );
}
