import { useBasic } from '@basictech/react';
import { Button } from '@/components/ui/button';
import { UserIcon, LogOutIcon, DatabaseIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { basicApi } from '@/lib/basic-api';

export function BasicAuthButton() {
  const { signin, signout, isSignedIn, user } = useBasic();
  const [authToken, setAuthToken] = useState(null);
  const [isGettingToken, setIsGettingToken] = useState(false);
  const [tableData, setTableData] = useState(null);

  // Try to get token directly from Basic API on sign in
  const handleSignIn = async () => {
    try {
      setIsGettingToken(true);
      console.log('Attempting to sign in and get token...');
      
      // First trigger the Basic sign in
      await signin();
      
      // Wait a moment for the sign-in process to complete
      setTimeout(async () => {
        try {
          // Try to get token from cookies
          const success = basicApi.extractTokenFromCookies();
          if (success) {
            const token = basicApi.getToken();
            setAuthToken(token);
            console.log('Successfully obtained token after sign in:', token);
            
            // Log token data
            const tokenData = basicApi.getTokenData();
            if (tokenData) {
              console.log('Token data:', tokenData);
              console.log('Token expires in:', tokenData.expires_in, 'seconds');
              console.log('Refresh token:', tokenData.refresh);
            }
          } else {
            console.log('Failed to extract token after sign in');
          }
        } catch (error) {
          console.error('Error extracting token after sign in:', error);
        } finally {
          setIsGettingToken(false);
        }
      }, 1000); // Give it a second for cookies to be set
    } catch (error) {
      console.error('Sign in failed:', error);
      setIsGettingToken(false);
    }
  };

  // Extract token when user is signed in
  useEffect(() => {
    if (isSignedIn) {
      // Use the API's token extraction method
      const success = basicApi.extractTokenFromCookies();
      if (success) {
        setAuthToken(basicApi.getToken());
        
        // Log token data for debugging
        const tokenData = basicApi.getTokenData();
        if (tokenData) {
          console.log('Token expires in:', tokenData.expires_in, 'seconds');
          console.log('Refresh token available:', !!tokenData.refresh);
        }
      }
    } else {
      setAuthToken(null);
    }
  }, [isSignedIn]);

  // Example of using the API to fetch user data
  const fetchUserData = async () => {
    try {
      const userData = await basicApi.getUserInfo();
      console.log('User data from API:', userData);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  };

  // Function to fetch data from a specific table
  const fetchTableData = async (tableName) => {
    try {
      const data = await basicApi.getTableData(tableName);
      console.log(`Data from ${tableName} table:`, data);
      setTableData(data);
      return data;
    } catch (error) {
      console.error(`Failed to fetch ${tableName} data:`, error);
    }
  };

  // Function to fetch emojis table data
  const fetchEmojis = () => fetchTableData('emojis');
  
  // Function to fetch projects table data
  const fetchProjects = () => fetchTableData('projects');

  console.log('[BasicAuthButton] isSignedIn', isSignedIn, user);
  console.log('[BasicAuthButton] authToken', authToken);
  
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
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUserData}
            className="h-8 mr-2"
          >
            User Data
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEmojis}
            className="h-8 mr-2"
          >
            Fetch Emojis
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchProjects}
            className="h-8"
          >
            Fetch Projects
          </Button>
        </>
      ) : (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleSignIn}
          disabled={isGettingToken}
          className="h-8 w-full justify-start cursor-pointer"
        >
          <UserIcon size={16} className="mr-2" />
          {isGettingToken ? 'Signing In...' : 'Sign In'}
        </Button>
      )}
      
      {tableData && (
        <div className="mt-4 p-4 border rounded bg-slate-50 max-h-60 overflow-auto">
          <h3 className="font-medium mb-2">Table Data:</h3>
          <pre className="text-xs">{JSON.stringify(tableData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
} 