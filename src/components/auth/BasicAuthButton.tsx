import { useBasic } from '@basictech/react';
import { Button } from '@/components/ui/button';
import { UserIcon, LogOutIcon } from 'lucide-react';

export function BasicAuthButton() {
  const { signin, signout, isSignedIn, user } = useBasic();
  return (
    <div className="flex items-center gap-2 p-2">
      {isSignedIn ? (
        <>
          <span className="text-sm text-muted-foreground truncate max-w-[150px]">
            {user?.email || user?.primaryEmailAddress?.emailAddress}
          </span>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={signout}
            className="h-8"
          >
            <LogOutIcon size={16} className="mr-2" />
            Sign Out
          </Button>
        </>
      ) : (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={signin}
          className="h-8 w-full justify-start cursor-pointer"
        >
          <UserIcon size={16} className="mr-2" />
          Sign In
        </Button>
      )}
    </div>
  );
} 