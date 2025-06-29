"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { UploadedFile } from "./file-items";
import { FileItem } from "./file-items";

export type FileListProps = {
	files: UploadedFile[];
	onFileRemove: (file: UploadedFile) => void;
};

const TRANSITION = {
	type: "spring",
	duration: 0.2,
	bounce: 0,
};

export function FileList({ files, onFileRemove }: FileListProps) {
	return (
		<AnimatePresence initial={false}>
			{files.length > 0 && (
				<motion.div
					key="files-list"
					initial={{ height: 0 }}
					animate={{ height: "auto" }}
					exit={{ height: 0 }}
					transition={TRANSITION}
					className="overflow-hidden"
				>
					<div className="flex flex-row overflow-x-auto pl-3">
						<AnimatePresence initial={false}>
							{files.map((file) => (
								<motion.div
									key={file.name + file.size}
									initial={{ width: 0 }}
									animate={{ width: 180 }}
									exit={{ width: 0 }}
									transition={TRANSITION}
									className="relative shrink-0 overflow-hidden pt-2"
								>
									<FileItem file={file} onRemove={onFileRemove} />
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
