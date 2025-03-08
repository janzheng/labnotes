import { useBasic } from '@basictech/react';
import { Button } from '@/components/ui/button';
import { UserIcon, LogOutIcon, DatabaseIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

export function BasicAuthButton() {
  const { signin, signout, isSignedIn, user, getToken, db } = useBasic();
  
  useEffect(() => {
    // Renamed function to avoid naming conflict with destructured getToken
    const fetchToken = async () => {
      if (isSignedIn && user) {
        const token = await getToken();
        // console.log('Signed in user:', user);
        // console.log('User token:', token);
        console.log('BasicDB:', {
          projects: await db.collection('projects').getAll(),
          workspaces: await db.collection('workspaces').getAll()
        });
      }
    };
    fetchToken();
  }, [isSignedIn, user, getToken]); // Added getToken to dependency array

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
            className="h-8 mr-2"
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