import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  onFinish: () => void;
};

function SplashScreen({ onFinish }: Props) {
  useEffect(() => {
    const timer = setTimeout(onFinish, 2000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/rayna-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '70%',
    height: undefined,
    aspectRatio: 617 / 229,
  },
});

export default SplashScreen;
