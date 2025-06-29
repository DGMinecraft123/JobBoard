import React from 'react';

// User Avatar Component with proper initials generation
export const UserAvatar = ({ 
  firstName, 
  lastName, 
  profilePictureUrl, 
  size = 40,
  className = ""
}: { 
  firstName: string; 
  lastName: string; 
  profilePictureUrl?: string; 
  size?: number;
  className?: string;
}) => {
  // Function to generate initials (first letter of first name + first letter of last name)
  const generateInitials = (first: string, last: string): string => {
    const firstInitial = first ? first.charAt(0).toUpperCase() : '';
    const lastInitial = last ? last.charAt(0).toUpperCase() : '';
    return firstInitial + lastInitial;
  };

  // Function to check if profile picture URL is valid
  const isValidProfilePicture = (url?: string): boolean => {
    if (!url) return false;
    // Check if it's a valid URL and not just text
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const initials = generateInitials(firstName, lastName);
  const hasValidPicture = isValidProfilePicture(profilePictureUrl);

  return (
    <div 
      className={`relative flex shrink-0 overflow-hidden rounded-full bg-blue-600 ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {hasValidPicture ? (
        <img 
          src={profilePictureUrl} 
          alt={`${firstName} ${lastName}`}
          className="aspect-square h-full w-full object-cover"
          onError={(e) => {
            // Hide the image on error, fallback will show
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      ) : null}
      
      {/* Always show initials as fallback or when no valid image */}
      <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-600">
        <span className="text-white font-semibold" style={{ fontSize: `${Math.max(size * 0.4, 12)}px` }}>
          {initials}
        </span>
      </div>
    </div>
  );
}; 