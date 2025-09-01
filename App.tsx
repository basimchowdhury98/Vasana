import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [wakeupTime, setWakeupTime] = useState(new Date());

  useEffect(() => {
    const loadWakeupTime = async () => {
      try
      {
        const timeValue = await AsyncStorage.getItem('wakeup-time');
        if (timeValue === null)
        {
          return;
        }
        var storedTime = new Date(timeValue);
        setWakeupTime(storedTime);
      }
      catch(e)
      {
        console.log(e);
      }
    }
    loadWakeupTime();
  }, [])

  const storeTime = async (time: Date) => {
    Notifications.scheduleNotificationAsync({
      content: {
        title: 'Look at that notification',
        body: "I'm so proud of myself!",
      },
      trigger: null,
    });

    await AsyncStorage.setItem('wakeup-time', time.toISOString());
    setWakeupTime(time);
  }

  return (
    <View style={styles.container}>
      <Text>Welcome to Vasanas!</Text>
      <Text>Choose your wake up time</Text>
      <StatusBar style="auto" />
      <DateTimePicker 
            testID="dateTimePicket"
            value={wakeupTime}
            mode="time"
            onChange={async (_, date) =>{
              date && await storeTime(date)}
            } 
          />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
