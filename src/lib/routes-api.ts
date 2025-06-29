// Google Routes API integration for commute calculations

interface RouteRequest {
  origin: {
    address: string;
  };
  destination: {
    address: string;
  };
  travelMode: 'DRIVE' | 'TRANSIT' | 'WALK' | 'BICYCLE';
  computeAlternativeRoutes?: boolean;
  departureTime?: string; // ISO 8601 timestamp for traffic prediction
  routingPreference?: 'TRAFFIC_AWARE' | 'TRAFFIC_UNAWARE' | 'TRAFFIC_AWARE_OPTIMAL';
  trafficModel?: 'BEST_GUESS' | 'PESSIMISTIC' | 'OPTIMISTIC';
  transitPreferences?: {
    routingPreference: 'LESS_WALKING' | 'FEWER_TRANSFERS';
    allowedTravelModes: string[];
  };
}

interface RouteResponse {
  routes: Array<{
    legs: Array<{
      steps: Array<{
        transitDetails?: {
          line: {
            name: string;
            shortName: string;
          };
          stopDetails: {
            arrivalStop: {
              name: string;
            };
            departureStop: {
              name: string;
            };
          };
        };
        distanceMeters: number;
        duration: string;
        travelMode: string;
      }>;
      distanceMeters: number;
      duration: string;
    }>;
  }>;
}

class RoutesAPI {
  private apiKey: string;
  private baseUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';

  constructor(apiKey?: string) {
    // Try to get API key from environment variable if not provided
    this.apiKey = apiKey || import.meta.env.VITE_GOOGLE_ROUTES_API_KEY;
    
    if (!this.apiKey) {
      throw new Error(
        'Google Routes API key not found. Please set VITE_GOOGLE_ROUTES_API_KEY in your .env file or pass it to the constructor.'
      );
    }
  }

  /**
   * Calculate commute times using Google Routes API
   */
  async calculateCommute(
    originAddress: string,
    destinationAddress: string,
    travelMode: 'DRIVE' | 'TRANSIT' = 'DRIVE',
    departureTime?: Date,
    trafficModel: 'BEST_GUESS' | 'PESSIMISTIC' | 'OPTIMISTIC' = 'BEST_GUESS'
  ): Promise<RouteResponse> {
    const requestBody: RouteRequest = {
      origin: {
        address: originAddress
      },
      destination: {
        address: destinationAddress
      },
      travelMode: travelMode,
      computeAlternativeRoutes: true
    };

    // Add departure time and traffic-aware routing if provided (only for DRIVE mode)
    if (departureTime && travelMode === 'DRIVE') {
      requestBody.departureTime = departureTime.toISOString();
      requestBody.routingPreference = 'TRAFFIC_AWARE_OPTIMAL';
      requestBody.trafficModel = trafficModel;
    } else if (departureTime && travelMode === 'TRANSIT') {
      // For transit, only add departure time, no routing preference or traffic model
      requestBody.departureTime = departureTime.toISOString();
    }

    // Add transit preferences for transit mode
    if (travelMode === 'TRANSIT') {
      requestBody.transitPreferences = {
        routingPreference: 'LESS_WALKING',
        allowedTravelModes: ['TRAIN', 'BUS', 'SUBWAY']
      };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.legs.steps.transitDetails,routes.legs.distanceMeters,routes.legs.duration'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data: RouteResponse = await response.json();
      
      // Check if we got valid route data
      if (!data.routes || data.routes.length === 0) {
        throw new Error(`No routes found for ${travelMode.toLowerCase()} from ${originAddress} to ${destinationAddress}`);
      }

      return data;
    } catch (error) {
      console.error('Error calling Google Routes API:', error);
      throw error;
    }
  }

  /**
   * Calculate commute times using Google Routes API with departure time for traffic prediction
   */
  async calculateCommuteWithDepartureTime(
    originAddress: string,
    destinationAddress: string,
    departureTime: Date,
    travelMode: 'DRIVE' | 'TRANSIT' = 'DRIVE',
    trafficModel: 'BEST_GUESS' | 'PESSIMISTIC' | 'OPTIMISTIC' = 'BEST_GUESS'
  ): Promise<RouteResponse> {
    const requestBody: RouteRequest = {
      origin: {
        address: originAddress
      },
      destination: {
        address: destinationAddress
      },
      travelMode: travelMode,
      computeAlternativeRoutes: true,
      departureTime: departureTime.toISOString()
    };

    // Add routing preference and traffic model only for DRIVE mode
    if (travelMode === 'DRIVE') {
      requestBody.routingPreference = 'TRAFFIC_AWARE_OPTIMAL';
      requestBody.trafficModel = trafficModel;
    }

    // Add transit preferences for transit mode
    if (travelMode === 'TRANSIT') {
      requestBody.transitPreferences = {
        routingPreference: 'LESS_WALKING',
        allowedTravelModes: ['TRAIN', 'BUS', 'SUBWAY']
      };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.legs.steps.transitDetails,routes.legs.distanceMeters,routes.legs.duration'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data: RouteResponse = await response.json();
      
      // Check if we got valid route data
      if (!data.routes || data.routes.length === 0) {
        throw new Error(`No routes found for ${travelMode.toLowerCase()} from ${originAddress} to ${destinationAddress}`);
      }

      return data;
    } catch (error) {
      console.error('Error calling Google Routes API with departure time:', error);
      throw error;
    }
  }

  /**
   * Calculate both driving and transit commute times
   */
  async calculateAllCommuteTimes(
    originAddress: string,
    destinationAddress: string,
    departureTime?: Date,
    trafficModel: 'BEST_GUESS' | 'PESSIMISTIC' | 'OPTIMISTIC' = 'BEST_GUESS'
  ): Promise<{
    car: RouteResponse;
    transit: RouteResponse;
  }> {
    try {
      const [carRoute, transitRoute] = await Promise.all([
        this.calculateCommute(originAddress, destinationAddress, 'DRIVE', departureTime, trafficModel),
        this.calculateCommute(originAddress, destinationAddress, 'TRANSIT', departureTime, trafficModel)
      ]);

      return {
        car: carRoute,
        transit: transitRoute
      };
    } catch (error) {
      console.error('Error calculating commute times:', error);
      throw error;
    }
  }

  /**
   * Calculate both driving and transit commute times with departure time
   */
  async calculateAllCommuteTimesWithDepartureTime(
    originAddress: string,
    destinationAddress: string,
    departureTime: Date,
    trafficModel: 'BEST_GUESS' | 'PESSIMISTIC' | 'OPTIMISTIC' = 'BEST_GUESS'
  ): Promise<{
    car: RouteResponse;
    transit: RouteResponse;
  }> {
    try {
      const [carRoute, transitRoute] = await Promise.all([
        this.calculateCommuteWithDepartureTime(originAddress, destinationAddress, departureTime, 'DRIVE', trafficModel),
        this.calculateCommuteWithDepartureTime(originAddress, destinationAddress, departureTime, 'TRANSIT', trafficModel)
      ]);

      return {
        car: carRoute,
        transit: transitRoute
      };
    } catch (error) {
      console.error('Error calculating commute times with departure time:', error);
      throw error;
    }
  }

  /**
   * Format duration from Google API response or seconds
   */
  formatDuration(duration: string | number): string {
    // If it's a number, treat it as seconds
    if (typeof duration === 'number') {
      return this.formatSeconds(duration);
    }

    // Check if it's a string ending with 's' (seconds format like "2889s")
    const secondsMatch = duration.match(/^(\d+)s$/);
    if (secondsMatch) {
      const seconds = parseInt(secondsMatch[1]);
      return this.formatSeconds(seconds);
    }

    // Google API returns duration in format like "PT25M" (25 minutes) or "PT1H30M" (1 hour 30 minutes)
    // Convert to readable format
    const hourMatch = duration.match(/PT(\d+)H/);
    const minuteMatch = duration.match(/PT(\d+)M/);
    const hourMinuteMatch = duration.match(/PT(\d+)H(\d+)M/);
    
    if (hourMinuteMatch) {
      // Format like "PT1H30M"
      const hours = parseInt(hourMinuteMatch[1]);
      const minutes = parseInt(hourMinuteMatch[2]);
      return `${hours}h ${minutes}m`;
    } else if (hourMatch) {
      // Format like "PT2H"
      const hours = parseInt(hourMatch[1]);
      return `${hours}h`;
    } else if (minuteMatch) {
      // Format like "PT25M"
      const minutes = parseInt(minuteMatch[1]);
      if (minutes < 60) {
        return `${minutes}m`;
      } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
      }
    }
    return duration;
  }

  /**
   * Format seconds to human-readable time (e.g., 2889s -> "48m" or "1h 20m")
   */
  formatSeconds(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${remainingMinutes}m`;
    }
  }

  /**
   * Format distance from meters
   */
  formatDistance(meters: number): string {
    const miles = meters * 0.000621371; // Convert meters to miles
    return `${miles.toFixed(1)} miles`;
  }

  /**
   * Extract transit route information
   */
  extractTransitRoute(route: RouteResponse): string {
    if (!route.routes || route.routes.length === 0) return 'No route found';
    if (!route.routes[0].legs || route.routes[0].legs.length === 0) return 'No route legs found';
    if (!route.routes[0].legs[0].steps) return 'No route steps found';

    const steps = route.routes[0].legs[0].steps;
    const transitSteps = steps.filter(step => step.transitDetails);

    if (transitSteps.length === 0) return 'Walking only';

    return transitSteps.map(step => {
      if (step.transitDetails && step.transitDetails.line) {
        const line = step.transitDetails.line;
        // Use shortName if available, otherwise fall back to name
        return line.shortName || line.name || 'Transit';
      }
      return 'Walk';
    }).join(' → ');
  }
}

// Export a singleton instance
let routesAPIInstance: RoutesAPI | null = null;

export const initializeRoutesAPI = (apiKey?: string): RoutesAPI => {
  if (!routesAPIInstance) {
    routesAPIInstance = new RoutesAPI(apiKey);
  }
  return routesAPIInstance;
};

export const getRoutesAPI = (): RoutesAPI => {
  if (!routesAPIInstance) {
    throw new Error('Routes API not initialized. Call initializeRoutesAPI first.');
  }
  return routesAPIInstance;
};

export default RoutesAPI; 