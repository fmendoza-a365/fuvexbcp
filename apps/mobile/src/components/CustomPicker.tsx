import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StyleProp,
  ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CustomPickerProps {
  selectedValue: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
  theme: any;
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function CustomPicker({
  selectedValue,
  onValueChange,
  options,
  placeholder = 'Seleccionar...',
  theme,
  isDark,
  style
}: CustomPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);

  // Find the selected option or default to the placeholder/first option
  const selectedOption = options.find((opt) => opt.value === selectedValue);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const handleSelect = (val: string) => {
    onValueChange(val);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.selector,
          {
            backgroundColor: theme.input,
            borderColor: theme.border,
          },
          style
        ]}
        onPress={() => setModalVisible(true)}
      >
        <Text
          numberOfLines={1}
          style={[styles.selectorText, { color: selectedValue ? theme.text : theme.muted }]}
        >
          {displayText}
        </Text>
        <Ionicons name="chevron-down-outline" size={16} color={theme.subtext} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                borderTopColor: theme.border,
              }
            ]}
          >
            <SafeAreaView style={styles.safeArea}>
              <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>
                  {placeholder}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={22} color={theme.subtext} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={options}
                keyExtractor={(item) => `${item.value}-${item.label}`}
                renderItem={({ item }) => {
                  const isSelected = item.value === selectedValue;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.item,
                        {
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#E6EAF4')
                            : 'transparent'
                        }
                      ]}
                      onPress={() => handleSelect(item.value)}
                    >
                      <Text
                        style={[
                          styles.itemText,
                          {
                            color: isSelected ? theme.blue : theme.text,
                            fontWeight: isSelected ? '900' : 'normal',
                          }
                        ]}
                      >
                        {item.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color={theme.blue} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.listContent}
              />
            </SafeAreaView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    width: '100%',
  },
  selectorText: {
    fontSize: 14,
    flex: 1,
    paddingRight: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },
  safeArea: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 40,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  itemText: {
    fontSize: 14,
    flex: 1,
  },
});
