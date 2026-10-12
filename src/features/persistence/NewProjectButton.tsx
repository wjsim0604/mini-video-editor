import { FilePlus2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog.tsx';
import { Button } from '@/components/ui/button.tsx';
import { startNewProject } from './session.ts';

/** 저장본과 원본 파일을 지우고 빈 프로젝트로 시작한다 (되돌릴 수 없으므로 확인을 받는다) */
export function NewProjectButton() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <FilePlus2 />새 프로젝트
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>새 프로젝트를 시작할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            현재 프로젝트와 가져온 파일을 지웁니다. 이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60"
            onClick={() => {
              void startNewProject();
            }}
          >
            지우고 새로 시작
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
