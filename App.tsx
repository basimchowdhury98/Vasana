import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';

export default function App() {
  const [date, setDate] = useState(new Date());

  return (
    <View style={styles.container}>
      <Text>Welcome to Vasanas!</Text>
      <Text>Choose your wake up time</Text>
      <StatusBar style="auto" />
      <DateTimePicker 
            testID="dateTimePicket"
            value={date}
            mode="time"
            onChange={(_, date) => date && setDate(date)}
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
